import { BACKEND_BASE_URL } from "./components/streaming_helpers";
import {
  ContextSegment,
  Evaluation,
  Segment,
  VocabEvaluation,
  VideoContext,
  VideoView,
  Vocabulary,
  UserUIState,
  UserSettings,
  DEFAULT_USER_SETTINGS,
} from "./types";
import { splitSegmentsIntoSentences } from "./helpers";

export interface FetchVideoContextParams {
  supabase: any;
  videoId: string;
  recordId: string;
  initialSentence?: number;
  clip?: number;
}

export interface FetchVideoContextResult {
  videoContext: VideoContext;
  videoView: VideoView;
}

export const fetchVideoContext = async ({
  supabase,
  videoId,
  recordId,
  initialSentence,
  clip,
}: FetchVideoContextParams): Promise<FetchVideoContextResult> => {
  const { data: transcriptSegments, error: transcriptSegmentsError } =
    await supabase
      .from("transcript_segment")
      .select("*")
      .eq("video_id", recordId)
      .order("segment_id");

  if (transcriptSegmentsError) {
    console.error(transcriptSegmentsError);
    throw new Error("Failed to fetch transcript segments");
  }

  const { data: videoViewData, error: videoViewError } = await supabase
    .from("video_views")
    .upsert(
      {
        video_id: recordId,
        watched_at: new Date(),
      },
      {
        onConflict: "user_id,video_id",
        ignoreDuplicates: false,
      },
    )
    .select("id, last_sentence_watched, video_id, watched_at");

  if (videoViewError) {
    console.error(videoViewError);
  }

  const videoViewId = videoViewData?.[0]?.id ?? "";

  const { data: focusVocabData, error: focusVocabError } = await supabase
    .from("video_view_focus_vocab")
    .select("*")
    .eq("video_view_id", videoViewId);

  if (focusVocabError) {
    console.error(focusVocabError);
  }

  const focusVocab = focusVocabData?.map((v: any) => v.vocabulary_id) ?? [];

  const { data: focusSentenceData, error: focusSentenceError } = await supabase
    .from("video_view_focus_sentence")
    .select("*")
    .eq("video_view_id", videoViewId);

  if (focusSentenceError) {
    console.error(focusSentenceError);
  }

  const focusSentences = focusSentenceData ?? [];
  const sentences = splitSegmentsIntoSentences(transcriptSegments);

  let currentSentence =
    initialSentence ?? videoViewData?.[0]?.last_sentence_watched ?? 0;

  if (clip !== undefined) {
    const clipSentenceIndex = sentences.findIndex(
      (sentence) => clip >= sentence.start && clip <= sentence.end,
    );
    if (clipSentenceIndex !== -1) {
      currentSentence = clipSentenceIndex;
    }
  }

  const videoContext: VideoContext = {
    videoId,
    recordId,
    currentSentence,
    sentences,
    allWords: transcriptSegments.flatMap((s: Segment) => s.words),
    videoViewId,
    focusVocab,
    focusSentences,
  };

  const videoView: VideoView = videoViewData?.[0] as VideoView;

  return { videoContext, videoView };
};

export interface FetchReviewContextParams {
  searchQuery: string;
  videoId: string;
}

export const fetchReviewContext = async ({
  searchQuery,
  videoId,
}: FetchReviewContextParams): Promise<ContextSegment[]> => {
  const response = await fetch(`${BACKEND_BASE_URL}/review-context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      search_query: searchQuery,
      video_id: videoId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error fetching context: ${response.status}`);
  }

  const data = await response.json();
  return data.segments || [];
};

export interface EvaluateVocabAnswerParams {
  question: string;
  userAnswer: string;
  contextSegments: { text: string }[];
  vocabWord: string;
  quizType?: "vocab" | "phrase";
}

export const evaluateVocabAnswer = async ({
  question,
  userAnswer,
  contextSegments,
  vocabWord,
  quizType = "vocab",
}: EvaluateVocabAnswerParams): Promise<VocabEvaluation | null> => {
  const response = await fetch(`${BACKEND_BASE_URL}/evaluate-vocab-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      user_answer: userAnswer,
      context_segments: contextSegments,
      vocab_word: vocabWord,
      quiz_type: quizType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error evaluating vocab answer: ${response.status}`);
  }

  const data = await response.json();
  if (data.score && data.accepted_answers) {
    return {
      score: data.score,
      acceptedAnswers: data.accepted_answers,
    };
  }
  return null;
};

export interface EvaluateReviewAnswerParams {
  question: string;
  idealAnswer: string;
  userAnswer: string;
  contextSegments: { text: string }[];
}

export const evaluateReviewAnswer = async ({
  question,
  idealAnswer,
  userAnswer,
  contextSegments,
}: EvaluateReviewAnswerParams): Promise<Evaluation | null> => {
  const response = await fetch(`${BACKEND_BASE_URL}/evaluate-review-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      ideal_answer: idealAnswer,
      user_answer: userAnswer,
      context_segments: contextSegments,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error evaluating answer: ${response.status}`);
  }

  const data = await response.json();
  if (data.feedback && data.score) {
    return { feedback: data.feedback, score: data.score };
  }
  return null;
};

export interface FetchTranslationInsightsParams {
  text: string;
  translation: string;
}

export interface TranslationInsightsResult {
  properNouns: string[];
}

export const fetchTranslationInsights = async ({
  text,
  translation,
}: FetchTranslationInsightsParams): Promise<TranslationInsightsResult | null> => {
  const response = await fetch(`${BACKEND_BASE_URL}/translation-insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, translation }),
  });

  if (!response.ok) {
    throw new Error(`Error fetching translation insights: ${response.status}`);
  }

  const data = await response.json();
  if (data.proper_nouns) {
    return { properNouns: data.proper_nouns };
  }
  return null;
};

export interface FetchAllVideosParams {
  supabase: any;
}

export interface FetchAllVideosResult {
  channelData: any[];
  videoData: any[];
  topicData: any[];
  channelTopicData: any[];
}

export const fetchAllVideos = async ({
  supabase,
}: FetchAllVideosParams): Promise<FetchAllVideosResult> => {
  const { data: channelData, error: channelError } = await supabase
    .from("channel")
    .select("*");
  if (channelError) console.error(channelError);

  const { data: videoData, error: videoError } = await supabase
    .from("video")
    .select("*");
  if (videoError) console.error(videoError);

  const { data: topicData, error: topicError } = await supabase
    .from("topic")
    .select("*");
  if (topicError) console.error(topicError);
  console.log({ topicData });

  const { data: channelTopicData, error: channelTopicError } = await supabase
    .from("channel_topic")
    .select("*");
  if (channelTopicError) console.error(channelTopicError);
  console.log({ channelTopicData });

  return {
    channelData: channelData ?? [],
    videoData: videoData ?? [],
    topicData: topicData ?? [],
    channelTopicData: channelTopicData ?? [],
  };
};

export interface FetchAllVocabularyParams {
  supabase: any;
}

export const fetchAllVocabulary = async ({
  supabase,
}: FetchAllVocabularyParams): Promise<Vocabulary[]> => {
  let allVocab: Vocabulary[] = [];
  let from = 0;
  const limit = 1000;
  let fetching = true;

  while (fetching) {
    const { data, error } = await supabase
      .from("vocabulary")
      .select("id, word, translation, frequency")
      .range(from, from + limit - 1);

    if (error) {
      console.error(error);
      fetching = false;
    } else {
      const vocabBatch = (data as Vocabulary[]) ?? [];
      allVocab = [...allVocab, ...vocabBatch];
      if (vocabBatch.length < limit) {
        fetching = false;
      } else {
        from += limit;
      }
    }
  }

  return allVocab;
};

export interface FetchUserKnownVocabParams {
  supabase: any;
}

export const fetchUserKnownVocab = async ({
  supabase,
}: FetchUserKnownVocabParams): Promise<number[]> => {
  const { data, error } = await supabase
    .from("user_known_vocab")
    .select("vocabulary_id");

  if (error) console.error(error);

  const vocabIds = (data ?? []).map(
    (row: { vocabulary_id: number }) => row.vocabulary_id,
  );
  return vocabIds;
};

export interface FetchUserVideoViewsParams {
  supabase: any;
}

export const fetchUserVideoViews = async ({
  supabase,
}: FetchUserVideoViewsParams): Promise<VideoView[]> => {
  const { data, error } = await supabase
    .from("video_views")
    .select("id, video_id, watched_at");

  if (error) console.error(error);

  const videoViews = (data as VideoView[]) ?? [];
  return videoViews;
};

export interface RestoreUserUIStateParams {
  supabase: any;
  userId: string | null;
}

export interface RestoreUserUIStateResult {
  videoContext: VideoContext | null;
  currentTab: "watch" | "discuss" | "shadow" | null;
  settings: UserSettings;
}

export const restoreUserUIState = async ({
  supabase,
  userId,
}: RestoreUserUIStateParams): Promise<RestoreUserUIStateResult> => {
  const defaultResult = {
    videoContext: null,
    currentTab: null,
    settings: DEFAULT_USER_SETTINGS,
  };

  if (!userId) {
    return defaultResult;
  }

  try {
    const { data: uiState, error } = (await supabase
      .from("user_ui_state")
      .select("*")
      .eq("user_id", userId)
      .single()) as { data: UserUIState; error: any };

    if (error) {
      // No existing state is fine, just skip restoration
      if (error.code !== "PGRST116") {
        console.error("Error fetching user UI state:", error);
      }
      return defaultResult;
    }

    const settings: UserSettings = {
      playbackSpeed:
        uiState.playback_speed ?? DEFAULT_USER_SETTINGS.playbackSpeed,
      showWordsHints:
        uiState.show_word_hints ?? DEFAULT_USER_SETTINGS.showWordsHints,
      showCharacters:
        uiState.show_characters ?? DEFAULT_USER_SETTINGS.showCharacters,
      showStartsOffAs:
        uiState.show_starts_off_as ?? DEFAULT_USER_SETTINGS.showStartsOffAs,
    };

    if (uiState?.current_video) {
      // Fetch the video record to get the video_id string
      const { data: videoRecord, error: videoError } = await supabase
        .from("video")
        .select("video_id")
        .eq("id", uiState.current_video)
        .single();

      if (videoError || !videoRecord) {
        console.error("Error fetching video record:", videoError);
        return { ...defaultResult, settings };
      }

      const { videoContext } = await fetchVideoContext({
        supabase,
        videoId: videoRecord.video_id,
        recordId: uiState.current_video,
        initialSentence: uiState.current_sentence ?? 0,
      });

      return {
        videoContext,
        currentTab: uiState.current_tab ?? null,
        settings,
      };
    }

    return { videoContext: null, currentTab: null, settings };
  } catch (err) {
    console.error("Error restoring user UI state:", err);
    return defaultResult;
  }
};

export interface PersistUserUITabParams {
  supabase: any;
  userId: string | null;
  currentTab: "watch" | "discuss" | "shadow";
}

export const persistUserUITab = async ({
  supabase,
  userId,
  currentTab,
}: PersistUserUITabParams): Promise<void> => {
  if (!supabase || !userId) return;

  const { error } = await supabase
    .from("user_ui_state")
    .upsert(
      { user_id: userId, current_tab: currentTab, updated_at: new Date() },
      { onConflict: "user_id" },
    );

  if (error) console.error("Error persisting tab:", error);
};

export const persistUserSettings = async ({
  supabase,
  userId,
  settings,
}: {
  supabase: any;
  userId: string | null;
  settings: Partial<UserSettings>;
}): Promise<void> => {
  if (!supabase || !userId) return;

  const updateData: Record<string, any> = {
    user_id: userId,
    updated_at: new Date(),
  };
  if (settings.playbackSpeed !== undefined)
    updateData.playback_speed = settings.playbackSpeed;
  if (settings.showWordsHints !== undefined)
    updateData.show_word_hints = settings.showWordsHints;
  if (settings.showCharacters !== undefined)
    updateData.show_characters = settings.showCharacters;
  if (settings.showStartsOffAs !== undefined)
    updateData.show_starts_off_as = settings.showStartsOffAs;

  const { error } = await supabase
    .from("user_ui_state")
    .upsert(updateData, { onConflict: "user_id" });

  if (error) console.error("Error persisting settings:", error);
};
