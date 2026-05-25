import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LanguageCode, Video } from "../../types";

export type GuidedLearningLevelBand =
  | "beginner"
  | "lower intermediate"
  | "upper intermediate"
  | "advanced";

export type GuidedLearningProgressStatus = "started" | "completed" | "skipped";

export interface GuidedLearningPassage {
  source: "learning_passage" | "top_verb_video" | "video";
  sourceKey: string;
  passageId: string | number | null;
  topVerbVideoId: string | number | null;
  videoRecordId: string;
  verbId: string | number | null;
  language: "es";
  levelBand: GuidedLearningLevelBand;
  rank: number;
  skillFocus: string;
  startSegmentId: number | null;
  endSegmentId: number | null;
  difficultyLabel: string;
  score: number;
}

export interface GuidedLearningProgress {
  sourceKey: string;
  passageId: string | number | null;
  status: GuidedLearningProgressStatus;
  confidence: number | null;
  updatedAt: string;
}

export interface GuidedLearningRecommendationResult {
  passage: GuidedLearningPassage | null;
  progress: Record<string, GuidedLearningProgress>;
  persistence: "supabase" | "local";
  usedFallback: boolean;
}

interface TopVerbVideoRecord {
  id: string | number;
  video_id: string | number | null;
  verb_id: string | number | null;
  count: number | null;
  difficulty: string | null;
  start: number | null;
  end: number | null;
}

interface LearningPassageRecord {
  id: string | number;
  language: string | null;
  top_verb_video_id: string | number | null;
  video_id: string | number | null;
  verb_id: string | number | null;
  level_band: string | null;
  rank_order: number | null;
  skill_focus: string | null;
  start_segment_id: number | null;
  end_segment_id: number | null;
}

interface ProgressRecord {
  source_key: string | null;
  passage_id: string | number | null;
  status: GuidedLearningProgressStatus | null;
  confidence: number | null;
  updated_at: string | null;
}

const GUIDED_PROGRESS_STORAGE_KEY = "tempo.guidedLearning.progress.es";
const CURATED_COURSE_LIMIT = 200;

const LEVEL_BANDS: GuidedLearningLevelBand[] = [
  "beginner",
  "lower intermediate",
  "upper intermediate",
  "advanced",
];

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

export const normalizeLevelBand = (
  value: string | null | undefined,
): GuidedLearningLevelBand => {
  const normalized = normalizeText(value).replace(/[_-]+/g, " ");
  if (normalized.includes("advanced")) return "advanced";
  if (normalized.includes("upper")) return "upper intermediate";
  if (normalized.includes("lower")) return "lower intermediate";
  if (normalized.includes("intermediate")) return "lower intermediate";
  if (normalized.includes("beginner") || normalized.includes("intro")) {
    return "beginner";
  }
  return "lower intermediate";
};

export const getLevelBandLabel = (levelBand: GuidedLearningLevelBand): string =>
  levelBand
    .split(" ")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

const isProgressStatus = (
  value: string | null,
): value is GuidedLearningProgressStatus =>
  value === "started" || value === "completed" || value === "skipped";

const getVideoDifficulty = (video: Video): string =>
  normalizeText(video.difficulty) || "lower intermediate";

const loadLocalProgress = async (): Promise<
  Record<string, GuidedLearningProgress>
> => {
  try {
    const value = await AsyncStorage.getItem(GUIDED_PROGRESS_STORAGE_KEY);
    if (!value) return {};
    const parsed = JSON.parse(value) as Record<string, GuidedLearningProgress>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveLocalProgress = async (
  progress: Record<string, GuidedLearningProgress>,
) => {
  await AsyncStorage.setItem(
    GUIDED_PROGRESS_STORAGE_KEY,
    JSON.stringify(progress),
  );
};

const loadRemoteProgress = async ({
  publicSupabase,
  userId,
}: {
  publicSupabase: any;
  userId: string | null | undefined;
}): Promise<Record<string, GuidedLearningProgress> | null> => {
  if (!userId) return null;

  const { data, error } = await publicSupabase
    .from("user_learning_passage_progress")
    .select("source_key,passage_id,status,confidence,updated_at")
    .eq("user_id", userId)
    .eq("language", "es");

  if (error) {
    console.error("Guided progress table unavailable:", error);
    return null;
  }

  return ((data ?? []) as ProgressRecord[]).reduce(
    (progress, record) => {
      if (!record.source_key || !isProgressStatus(record.status)) {
        return progress;
      }

      progress[record.source_key] = {
        sourceKey: record.source_key,
        passageId: record.passage_id ?? null,
        status: record.status,
        confidence:
          typeof record.confidence === "number" ? record.confidence : null,
        updatedAt: record.updated_at ?? new Date().toISOString(),
      };
      return progress;
    },
    {} as Record<string, GuidedLearningProgress>,
  );
};

const loadProgress = async ({
  publicSupabase,
  userId,
}: {
  publicSupabase: any;
  userId: string | null | undefined;
}): Promise<{
  progress: Record<string, GuidedLearningProgress>;
  persistence: "supabase" | "local";
}> => {
  const localProgress = await loadLocalProgress();
  const remoteProgress = await loadRemoteProgress({ publicSupabase, userId });
  if (!remoteProgress) {
    return { progress: localProgress, persistence: "local" };
  }

  return {
    progress: { ...localProgress, ...remoteProgress },
    persistence: "supabase",
  };
};

const loadLearningPassageCandidates = async ({
  publicSupabase,
  targetLanguageVideos,
}: {
  publicSupabase: any;
  targetLanguageVideos: Video[];
}): Promise<GuidedLearningPassage[] | null> => {
  const { data, error } = await publicSupabase
    .from("learning_passage")
    .select(
      [
        "id",
        "language",
        "top_verb_video_id",
        "video_id",
        "verb_id",
        "level_band",
        "rank_order",
        "skill_focus",
        "start_segment_id",
        "end_segment_id",
      ].join(","),
    )
    .eq("language", "es")
    .order("rank_order", { ascending: true })
    .limit(CURATED_COURSE_LIMIT);

  if (error) {
    console.error("Guided learning passage table unavailable:", error);
    return null;
  }

  const videoByRecordId = new Map(
    targetLanguageVideos.map((video) => [String(video.id), video]),
  );

  return ((data ?? []) as LearningPassageRecord[])
    .map((record, index) => {
      if (!record.video_id) return null;
      const video = videoByRecordId.get(String(record.video_id));
      if (!video) return null;

      const rank = Number(record.rank_order ?? index + 1);
      const passage: GuidedLearningPassage = {
        source: "learning_passage" as const,
        sourceKey: `learning_passage:${record.id}`,
        passageId: record.id,
        topVerbVideoId: record.top_verb_video_id ?? null,
        videoRecordId: String(video.id),
        verbId: record.verb_id ?? null,
        language: "es" as const,
        levelBand: normalizeLevelBand(record.level_band || video.difficulty),
        rank,
        skillFocus: record.skill_focus || "guided practice",
        startSegmentId:
          typeof record.start_segment_id === "number"
            ? record.start_segment_id
            : null,
        endSegmentId:
          typeof record.end_segment_id === "number"
            ? record.end_segment_id
            : null,
        difficultyLabel: getVideoDifficulty(video),
        score: Math.max(1, 1000 - rank),
      };
      return passage;
    })
    .filter((passage): passage is GuidedLearningPassage => passage !== null);
};

const loadTopVerbVideoCandidates = async ({
  publicSupabase,
  targetLanguageVideos,
}: {
  publicSupabase: any;
  targetLanguageVideos: Video[];
}): Promise<GuidedLearningPassage[] | null> => {
  const { data, error } = await publicSupabase
    .from("top_verb_video")
    .select("id,video_id,verb_id,count,difficulty,start,end")
    .order("count", { ascending: false })
    .limit(80);

  if (error) {
    console.error("Top verb video table unavailable:", error);
    return null;
  }

  const videoByRecordId = new Map(
    targetLanguageVideos.map((video) => [String(video.id), video]),
  );

  return ((data ?? []) as TopVerbVideoRecord[])
    .map((record, index) => {
      if (!record.video_id) return null;
      const video = videoByRecordId.get(String(record.video_id));
      if (!video) return null;

      const count = Number(record.count ?? 0);
      const passage: GuidedLearningPassage = {
        source: "top_verb_video" as const,
        sourceKey: `top_verb_video:${record.id}`,
        passageId: null,
        topVerbVideoId: record.id,
        videoRecordId: String(video.id),
        verbId: record.verb_id ?? null,
        language: "es" as const,
        levelBand: normalizeLevelBand(record.difficulty || video.difficulty),
        rank: index + 1,
        skillFocus: "verb forms",
        startSegmentId: typeof record.start === "number" ? record.start : null,
        endSegmentId: typeof record.end === "number" ? record.end : null,
        difficultyLabel: getVideoDifficulty(video),
        score: count,
      };
      return passage;
    })
    .filter((passage): passage is GuidedLearningPassage => passage !== null);
};

const buildVideoFallbackCandidates = (
  targetLanguageVideos: Video[],
): GuidedLearningPassage[] =>
  targetLanguageVideos.slice(0, 80).map((video, index) => ({
    source: "video",
    sourceKey: `video:${video.id}`,
    passageId: null,
    topVerbVideoId: null,
    videoRecordId: String(video.id),
    verbId: null,
    language: "es",
    levelBand: normalizeLevelBand(video.difficulty),
    rank: index + 1,
    skillFocus: "guided practice",
    startSegmentId: null,
    endSegmentId: null,
    difficultyLabel: getVideoDifficulty(video),
    score: Math.max(1, 200 - index),
  }));

export const selectGuidedLearningPassage = ({
  candidates,
  progress,
  targetLevelBand,
}: {
  candidates: GuidedLearningPassage[];
  progress: Record<string, GuidedLearningProgress>;
  targetLevelBand: GuidedLearningLevelBand;
}): GuidedLearningPassage | null => {
  const inBand = candidates.filter(
    (candidate) => candidate.levelBand === targetLevelBand,
  );
  const pool = inBand.length ? inBand : candidates;
  const available = pool.filter((candidate) => {
    const status = progress[candidate.sourceKey]?.status;
    return status !== "completed" && status !== "skipped";
  });
  const rankedPool = available.length ? available : pool;

  return (
    [...rankedPool].sort((a, b) => {
      const aProgress = progress[a.sourceKey]?.status;
      const bProgress = progress[b.sourceKey]?.status;
      const aStartedPenalty = aProgress === "started" ? 1000 : 0;
      const bStartedPenalty = bProgress === "started" ? 1000 : 0;
      const aScore = a.rank + aStartedPenalty - a.score / 100;
      const bScore = b.rank + bStartedPenalty - b.score / 100;
      return aScore - bScore;
    })[0] ?? null
  );
};

export const getGuidedLearningRecommendation = async ({
  publicSupabase,
  userId,
  targetLanguage,
  targetLanguageVideos,
  targetLevelBand,
}: {
  publicSupabase: any;
  userId: string | null | undefined;
  targetLanguage: LanguageCode | null;
  targetLanguageVideos: Video[];
  targetLevelBand: GuidedLearningLevelBand;
}): Promise<GuidedLearningRecommendationResult> => {
  if (targetLanguage !== "es") {
    return {
      passage: null,
      progress: {},
      persistence: "local",
      usedFallback: true,
    };
  }

  const { progress, persistence } = await loadProgress({
    publicSupabase,
    userId,
  });
  const learningPassages = await loadLearningPassageCandidates({
    publicSupabase,
    targetLanguageVideos,
  });
  const topVerbVideos = learningPassages?.length
    ? null
    : await loadTopVerbVideoCandidates({
        publicSupabase,
        targetLanguageVideos,
      });
  const candidates = learningPassages?.length
    ? learningPassages
    : topVerbVideos?.length
      ? topVerbVideos
      : buildVideoFallbackCandidates(targetLanguageVideos);

  return {
    passage: selectGuidedLearningPassage({
      candidates,
      progress,
      targetLevelBand,
    }),
    progress,
    persistence,
    usedFallback: !learningPassages?.length,
  };
};

export const saveGuidedLearningProgress = async ({
  publicSupabase,
  userId,
  passage,
  status,
  confidence,
}: {
  publicSupabase: any;
  userId: string | null | undefined;
  passage: GuidedLearningPassage;
  status: GuidedLearningProgressStatus;
  confidence?: number | null;
}): Promise<"supabase" | "local"> => {
  const updatedAt = new Date().toISOString();
  const progressRecord: GuidedLearningProgress = {
    sourceKey: passage.sourceKey,
    passageId: passage.passageId,
    status,
    confidence: typeof confidence === "number" ? confidence : null,
    updatedAt,
  };

  if (userId) {
    const { error } = await publicSupabase
      .from("user_learning_passage_progress")
      .upsert(
        {
          user_id: userId,
          language: "es",
          source_key: passage.sourceKey,
          passage_id: passage.passageId,
          status,
          confidence: progressRecord.confidence,
          updated_at: updatedAt,
          started_at: status === "started" ? updatedAt : undefined,
          completed_at: status === "completed" ? updatedAt : undefined,
          skipped_at: status === "skipped" ? updatedAt : undefined,
        },
        { onConflict: "user_id,source_key" },
      );

    if (!error) return "supabase";
    console.error("Guided progress remote save unavailable:", error);
  }

  const localProgress = await loadLocalProgress();
  await saveLocalProgress({
    ...localProgress,
    [passage.sourceKey]: progressRecord,
  });
  return "local";
};

export const GUIDED_LEARNING_LEVEL_BANDS = LEVEL_BANDS;
