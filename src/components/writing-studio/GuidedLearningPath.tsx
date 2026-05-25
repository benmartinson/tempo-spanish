import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@clerk/clerk-expo";
import {
  formatTimestamp,
  removeSpecialPunctuationFromPassage,
} from "../../helpers/helpers";
import type { Channel, LanguageCode, Segment, Video } from "../../types";
import { makeTranscriptRangeText } from "./helpers";
import type { VideoTranscriptSearchResult } from "./VideoTranscriptImport";
import {
  getGuidedLearningRecommendation,
  getLevelBandLabel,
  GUIDED_LEARNING_LEVEL_BANDS,
  type GuidedLearningLevelBand,
  type GuidedLearningPassage,
  saveGuidedLearningProgress,
} from "./guidedLearning";

interface GuidedLearningPathProps {
  allChannels: Channel[];
  publicSupabase: any;
  targetLanguage: LanguageCode | null;
  targetLanguageVideos: Video[];
  onBack: () => void;
  onChooseVideoTranscriptRange: (
    result: VideoTranscriptSearchResult,
    segments: Segment[],
    startIndex: number,
    endIndex: number,
  ) => void;
}

interface LoadedPassage {
  passage: GuidedLearningPassage;
  video: Video;
  segments: Segment[];
  startIndex: number;
  endIndex: number;
}

const DEFAULT_SEGMENT_COUNT = 3;

const getPassageRange = (
  passage: GuidedLearningPassage,
  segments: Segment[],
): { startIndex: number; endIndex: number } => {
  const lastIndex = Math.max(segments.length - 1, 0);
  const startBySegmentId =
    passage.startSegmentId === null
      ? -1
      : segments.findIndex(
          (segment) => Number(segment.segment_id) === passage.startSegmentId,
        );
  const startIndex = Math.max(0, startBySegmentId);
  const endBySegmentId =
    passage.endSegmentId === null
      ? -1
      : segments.findIndex(
          (segment) => Number(segment.segment_id) === passage.endSegmentId,
        );
  const endIndex =
    endBySegmentId >= startIndex
      ? endBySegmentId
      : Math.min(lastIndex, startIndex + DEFAULT_SEGMENT_COUNT - 1);

  return { startIndex, endIndex };
};

const titleCase = (value: string): string =>
  value
    .split(/\s+/)
    .map((word) =>
      word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word,
    )
    .join(" ");

const GuidedLearningPath: React.FC<GuidedLearningPathProps> = ({
  allChannels,
  publicSupabase,
  targetLanguage,
  targetLanguageVideos,
  onBack,
  onChooseVideoTranscriptRange,
}) => {
  const { userId } = useAuth();
  const [levelBand, setLevelBand] =
    useState<GuidedLearningLevelBand>("lower intermediate");
  const [loadedPassage, setLoadedPassage] = useState<LoadedPassage | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<"supabase" | "local">("local");
  const [usedFallback, setUsedFallback] = useState(false);
  const [confidence, setConfidence] = useState(3);
  const [refreshKey, setRefreshKey] = useState(0);
  const isSpanishTarget = targetLanguage === "es";
  const channelById = useMemo(
    () => new Map(allChannels.map((channel) => [channel.channel_id, channel])),
    [allChannels],
  );

  const loadSegments = useCallback(
    async (videoRecordId: string): Promise<Segment[]> => {
      const { data, error: segmentsError } = await publicSupabase
        .from("transcript_segment")
        .select("segment_id,start,end,text,video_id,words")
        .eq("video_id", videoRecordId)
        .order("segment_id");

      if (segmentsError) {
        console.error(
          "Error loading guided passage transcript:",
          segmentsError,
        );
        throw new Error("Could not load that transcript.");
      }

      return ((data ?? []) as Segment[]).filter((segment) =>
        Boolean(segment.text?.trim()),
      );
    },
    [publicSupabase],
  );

  const loadRecommendation = useCallback(async () => {
    if (!isSpanishTarget) {
      setLoadedPassage(null);
      setError("Guided practice is available for Spanish.");
      return;
    }

    setIsLoading(true);
    setActionStatus(null);
    setError(null);
    try {
      const recommendation = await getGuidedLearningRecommendation({
        publicSupabase,
        userId,
        targetLanguage,
        targetLanguageVideos,
        targetLevelBand: levelBand,
      });
      setPersistence(recommendation.persistence);
      setUsedFallback(recommendation.usedFallback);

      const passage = recommendation.passage;
      if (!passage) {
        setLoadedPassage(null);
        setError("No guided passages are ready for this level.");
        return;
      }

      const video =
        targetLanguageVideos.find(
          (item) => String(item.id) === passage.videoRecordId,
        ) ?? null;
      if (!video) {
        setLoadedPassage(null);
        setError("The recommended video is not available.");
        return;
      }

      const segments = await loadSegments(passage.videoRecordId);
      if (!segments.length) {
        setLoadedPassage(null);
        setError("No transcript found for that passage.");
        return;
      }

      const { startIndex, endIndex } = getPassageRange(passage, segments);
      setLoadedPassage({ passage, video, segments, startIndex, endIndex });
    } catch (loadError) {
      setLoadedPassage(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load guided practice.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    isSpanishTarget,
    levelBand,
    loadSegments,
    publicSupabase,
    targetLanguage,
    targetLanguageVideos,
    userId,
  ]);

  useEffect(() => {
    void loadRecommendation();
  }, [loadRecommendation, refreshKey]);

  const markProgress = useCallback(
    async (status: "started" | "completed" | "skipped") => {
      if (!loadedPassage) return "local";
      const nextPersistence = await saveGuidedLearningProgress({
        publicSupabase,
        userId,
        passage: loadedPassage.passage,
        status,
        confidence: status === "completed" ? confidence : null,
      });
      setPersistence(nextPersistence);
      return nextPersistence;
    },
    [confidence, loadedPassage, publicSupabase, userId],
  );

  const startPassage = useCallback(async () => {
    if (!loadedPassage) return;

    setActionStatus("Opening...");
    try {
      await markProgress("started");
      const { video, segments, startIndex, endIndex } = loadedPassage;
      const channel = channelById.get(video.channel_id);
      const result: VideoTranscriptSearchResult = {
        videoId: video.video_id,
        videoRecordId: video.id,
        channelId: video.channel_id,
        title: video.title,
        channelTitle: channel?.title ?? "Tempo channel",
        thumbnailUrl: video.thumbnail_url,
        matchedSegmentId: segments[startIndex]?.segment_id ?? null,
      };

      onChooseVideoTranscriptRange(result, segments, startIndex, endIndex);
    } catch (startError) {
      setActionStatus(null);
      setError(
        startError instanceof Error
          ? startError.message
          : "Could not open guided passage.",
      );
    }
  }, [channelById, loadedPassage, markProgress, onChooseVideoTranscriptRange]);

  const skipPassage = useCallback(async () => {
    if (!loadedPassage || isLoading) return;
    setActionStatus("Skipping...");
    try {
      await markProgress("skipped");
      setRefreshKey((key) => key + 1);
    } finally {
      setActionStatus(null);
    }
  }, [isLoading, loadedPassage, markProgress]);

  const completePassage = useCallback(async () => {
    if (!loadedPassage || isLoading) return;
    setActionStatus("Saving...");
    try {
      await markProgress("completed");
      setRefreshKey((key) => key + 1);
    } finally {
      setActionStatus(null);
    }
  }, [isLoading, loadedPassage, markProgress]);

  const passageText = loadedPassage
    ? removeSpecialPunctuationFromPassage(
        makeTranscriptRangeText(
          loadedPassage.segments,
          loadedPassage.startIndex,
          loadedPassage.endIndex,
        ),
      )
    : "";
  const startTime = loadedPassage
    ? (loadedPassage.segments[loadedPassage.startIndex]?.start ?? 0)
    : 0;
  const endTime = loadedPassage
    ? (loadedPassage.segments[loadedPassage.endIndex]?.end ?? startTime)
    : startTime;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator
    >
      <Pressable style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={16} color="#3d3a52" />
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Guided Practice</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>
              {persistence === "supabase"
                ? "Progress synced"
                : "Progress on device"}
            </Text>
          </View>
          {usedFallback && (
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>Derived path</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>Level</Text>
        <View style={styles.chipRow}>
          {GUIDED_LEARNING_LEVEL_BANDS.map((option) => {
            const isSelected = levelBand === option;
            return (
              <Pressable
                key={option}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => setLevelBand(option)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextSelected,
                  ]}
                >
                  {getLevelBandLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color="#5a5680" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={[styles.resultButton, styles.secondaryButton]}
            onPress={() => setRefreshKey((key) => key + 1)}
          >
            <Ionicons name="refresh" size={15} color="#3d3a52" />
            <Text style={styles.secondaryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : loadedPassage ? (
        <View style={styles.resultSection}>
          <View style={styles.videoRow}>
            <Image
              source={{ uri: loadedPassage.video.thumbnail_url ?? "" }}
              style={styles.videoThumbnail}
            />
            <View style={styles.videoTextGroup}>
              <Text style={styles.videoTitle} numberOfLines={2}>
                {loadedPassage.video.title}
              </Text>
              <Text style={styles.videoMeta} numberOfLines={1}>
                {channelById.get(loadedPassage.video.channel_id)?.title ??
                  "Tempo channel"}
              </Text>
              <Text style={styles.videoTime} numberOfLines={1}>
                {formatTimestamp(startTime)} - {formatTimestamp(endTime)}
              </Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {titleCase(loadedPassage.passage.difficultyLabel)}
                  </Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {titleCase(loadedPassage.passage.skillFocus)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.excerptText}>{passageText}</Text>

          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Confidence</Text>
            <View style={styles.confidenceRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const isSelected = confidence === value;
                return (
                  <Pressable
                    key={value}
                    style={[
                      styles.confidenceChip,
                      isSelected && styles.chipSelected,
                    ]}
                    onPress={() => setConfidence(value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.resultActions}>
            <Pressable
              style={[styles.resultButton, styles.secondaryButton]}
              onPress={skipPassage}
              disabled={Boolean(actionStatus)}
            >
              <Ionicons name="play-skip-forward" size={15} color="#3d3a52" />
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </Pressable>
            <Pressable
              style={[styles.resultButton, styles.secondaryButton]}
              onPress={completePassage}
              disabled={Boolean(actionStatus)}
            >
              <Ionicons name="checkmark" size={15} color="#3d3a52" />
              <Text style={styles.secondaryButtonText}>Done</Text>
            </Pressable>
            <Pressable
              style={[styles.resultButton, styles.primaryButton]}
              onPress={startPassage}
              disabled={Boolean(actionStatus)}
            >
              {actionStatus === "Opening..." ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="create-outline" size={15} color="#ffffff" />
              )}
              <Text style={styles.primaryButtonText}>Start</Text>
            </Pressable>
          </View>
          {actionStatus && actionStatus !== "Opening..." && (
            <Text style={styles.actionStatus}>{actionStatus}</Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 18,
    gap: 14,
  },
  backButton: {
    minHeight: 34,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 10,
  },
  backButtonText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "900",
  },
  header: {
    gap: 8,
  },
  headerTitle: {
    color: "#2f3140",
    fontSize: 18,
    fontWeight: "900",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusPill: {
    minHeight: 24,
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: "#eef7f2",
    borderWidth: 1,
    borderColor: "rgba(38, 112, 93, 0.12)",
  },
  statusPillText: {
    color: "#26705d",
    fontSize: 11,
    fontWeight: "900",
  },
  formSection: {
    gap: 8,
  },
  fieldLabel: {
    color: "#697187",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: 17,
    paddingHorizontal: 12,
    backgroundColor: "#f6f7fa",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.12)",
    cursor: "pointer" as any,
  },
  chipSelected: {
    backgroundColor: "#26705d",
    borderColor: "#26705d",
  },
  chipText: {
    color: "#3d3a52",
    fontSize: 12,
    fontWeight: "900",
  },
  chipTextSelected: {
    color: "#ffffff",
  },
  loadingState: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: "#697187",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    gap: 12,
  },
  errorText: {
    color: "#9f3c3c",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
  },
  resultSection: {
    gap: 14,
  },
  videoRow: {
    flexDirection: "row",
    gap: 12,
  },
  videoThumbnail: {
    width: 116,
    height: 66,
    borderRadius: 4,
    backgroundColor: "#e5e8ef",
  },
  videoTextGroup: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  videoTitle: {
    color: "#2f3140",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  videoMeta: {
    color: "#697187",
    fontSize: 12,
    fontWeight: "700",
  },
  videoTime: {
    color: "#26705d",
    fontSize: 12,
    fontWeight: "900",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 3,
  },
  badge: {
    minHeight: 22,
    justifyContent: "center",
    borderRadius: 11,
    paddingHorizontal: 8,
    backgroundColor: "#f3f5f8",
  },
  badgeText: {
    color: "#5a6172",
    fontSize: 10,
    fontWeight: "900",
  },
  excerptText: {
    color: "#2f3140",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "700",
  },
  confidenceRow: {
    flexDirection: "row",
    gap: 8,
  },
  confidenceChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f6f7fa",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.12)",
    cursor: "pointer" as any,
  },
  resultActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  resultButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 19,
    paddingHorizontal: 14,
    cursor: "pointer" as any,
  },
  secondaryButton: {
    backgroundColor: "#f3f5f8",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.12)",
  },
  secondaryButtonText: {
    color: "#3d3a52",
    fontSize: 12,
    fontWeight: "900",
  },
  primaryButton: {
    backgroundColor: "#26705d",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  actionStatus: {
    color: "#697187",
    fontSize: 12,
    fontWeight: "800",
  },
});

export default GuidedLearningPath;
