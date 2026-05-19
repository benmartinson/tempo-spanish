import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { TranscriptPhraseMatch } from "../../requests";
import {
  formatTimestamp,
  removeSpecialPunctuationFromPassage,
} from "../../helpers/helpers";
import type { Channel, ChannelTopic, Segment, Topic, Video } from "../../types";
import {
  escapeIlikePattern,
  formatTranscriptSearchText,
  makeTranscriptRangeText,
} from "./helpers";
import type { VideoTranscriptSearchResult } from "./VideoTranscriptImport";

type PracticeType = "any" | "vocab" | "conjugation";

interface FindVideoMatchProps {
  allChannels: Channel[];
  publicSupabase: any;
  targetLanguageVideos: Video[];
  onBack: () => void;
  onPreviewVideoMatch?: (match: TranscriptPhraseMatch | null) => void;
  onChooseVideoTranscriptRange: (
    result: VideoTranscriptSearchResult,
    segments: Segment[],
    startIndex: number,
    endIndex: number,
  ) => void;
}

interface SuggestedMatch {
  result: VideoTranscriptSearchResult;
  segments: Segment[];
  startIndex: number;
  endIndex: number;
  excerptText: string;
  difficultyLabel: string;
  topicLabel: string;
  startTime: number;
  endTime: number;
  clipMatch: TranscriptPhraseMatch;
}

const PRACTICE_OPTIONS: { label: string; value: PracticeType }[] = [
  { label: "Any", value: "any" },
  { label: "Vocab", value: "vocab" },
  { label: "Verb forms", value: "conjugation" },
];

const PARAGRAPH_OPTIONS = [1, 2, 3, 4, 5];
const BASE_DIFFICULTY_OPTIONS = [
  "any",
  "beginner",
  "lower intermediate",
  "upper intermediate",
  "advanced",
];

const titleCase = (value: string): string =>
  value
    .split(/\s+/)
    .map((word) =>
      word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word,
    )
    .join(" ");

const shuffle = <T,>(items: T[]): T[] => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const FindVideoMatch: React.FC<FindVideoMatchProps> = ({
  allChannels,
  publicSupabase,
  targetLanguageVideos,
  onBack,
  onPreviewVideoMatch,
  onChooseVideoTranscriptRange,
}) => {
  const [difficulty, setDifficulty] = useState<string>("any");
  const [difficultyDropdownOpen, setDifficultyDropdownOpen] = useState(false);
  const [practiceType, setPracticeType] = useState<PracticeType>("any");
  const [focusQuery, setFocusQuery] = useState("");
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [channelTopics, setChannelTopics] = useState<ChannelTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [paragraphCount, setParagraphCount] = useState(3);
  const [suggestion, setSuggestion] = useState<SuggestedMatch | null>(null);
  const [isFindingMatch, setIsFindingMatch] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const searchRunIdRef = useRef(0);

  useEffect(() => {
    return () => onPreviewVideoMatch?.(null);
  }, [onPreviewVideoMatch]);

  useEffect(() => {
    let cancelled = false;

    const loadTopics = async () => {
      setIsLoadingTopics(true);
      setTopicError(null);

      try {
        const [{ data: topicData, error: topicsError }, channelTopicResult] =
          await Promise.all([
            publicSupabase
              .from("topic")
              .select("id,description")
              .order("description"),
            publicSupabase.from("channel_topic").select("channel_id,topic_id"),
          ]);

        if (topicsError) {
          console.error(topicsError);
          throw new Error("Failed to load topics");
        }
        if (channelTopicResult.error) {
          console.error(channelTopicResult.error);
          throw new Error("Failed to load channel topics");
        }

        if (!cancelled) {
          setTopics((topicData ?? []) as Topic[]);
          setChannelTopics((channelTopicResult.data ?? []) as ChannelTopic[]);
        }
      } catch {
        if (!cancelled) {
          setTopics([]);
          setChannelTopics([]);
          setTopicError("Topics are unavailable.");
        }
      } finally {
        if (!cancelled) setIsLoadingTopics(false);
      }
    };

    void loadTopics();

    return () => {
      cancelled = true;
    };
  }, [publicSupabase]);

  const channelById = useMemo(
    () => new Map(allChannels.map((channel) => [channel.channel_id, channel])),
    [allChannels],
  );
  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [selectedTopicId, topics],
  );
  const topicChannelIds = useMemo(() => {
    if (selectedTopicId === null) return null;

    const matchingChannelRecordIds = new Set(
      channelTopics
        .filter((channelTopic) => channelTopic.topic_id === selectedTopicId)
        .map((channelTopic) => String(channelTopic.channel_id)),
    );

    return new Set(
      allChannels
        .filter((channel) => matchingChannelRecordIds.has(String(channel.id)))
        .map((channel) => channel.channel_id),
    );
  }, [allChannels, channelTopics, selectedTopicId]);

  const findStartIndex = (
    segments: Segment[],
    matchedSegmentId: number | null,
  ): number => {
    if (!segments.length) return 0;
    const maxStart = Math.max(0, segments.length - paragraphCount);
    if (matchedSegmentId !== null) {
      const matchedIndex = segments.findIndex(
        (segment) => segment.segment_id === matchedSegmentId,
      );
      if (matchedIndex >= 0) {
        return Math.max(0, Math.min(matchedIndex, maxStart));
      }
    }
    return Math.floor(Math.random() * (maxStart + 1));
  };

  const toSearchResult = (
    video: Video,
    matchedSegmentId: number | null,
  ): VideoTranscriptSearchResult => {
    const channel = channelById.get(video.channel_id);
    return {
      videoId: video.video_id,
      videoRecordId: video.id,
      channelId: video.channel_id,
      title: video.title,
      channelTitle: channel?.title ?? "Tempo channel",
      thumbnailUrl: video.thumbnail_url,
      matchedSegmentId,
    };
  };

  const loadSegments = async (videoRecordId: string): Promise<Segment[]> => {
    const { data, error } = await publicSupabase
      .from("transcript_segment")
      .select("segment_id,start,end,text,video_id,words")
      .eq("video_id", videoRecordId)
      .order("segment_id");

    if (error) {
      console.error(error);
      throw new Error("Failed to load transcript segments");
    }

    return ((data ?? []) as Segment[]).filter((segment) =>
      Boolean(segment.text?.trim()),
    );
  };

  const buildSuggestion = (
    video: Video,
    segments: Segment[],
    matchedSegmentId: number | null,
  ): SuggestedMatch | null => {
    if (!segments.length) return null;

    const startIndex = findStartIndex(segments, matchedSegmentId);
    const endIndex = Math.min(
      segments.length - 1,
      startIndex + paragraphCount - 1,
    );
    const result = toSearchResult(
      video,
      segments[startIndex]?.segment_id ?? null,
    );
    const channel = channelById.get(video.channel_id);
    const difficultyLabel =
      channel?.difficulty || video.difficulty || "Any difficulty";
    const topicLabel =
      selectedTopic?.description || video.topic || "Open topic";

    const excerptText = removeSpecialPunctuationFromPassage(
      makeTranscriptRangeText(segments, startIndex, endIndex),
    );
    const segmentText = removeSpecialPunctuationFromPassage(
      segments
        .slice(startIndex, endIndex + 1)
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(" "),
    );

    return {
      result,
      segments,
      startIndex,
      endIndex,
      excerptText,
      difficultyLabel,
      topicLabel,
      startTime: segments[startIndex]?.start ?? 0,
      endTime: segments[endIndex]?.end ?? segments[startIndex]?.end ?? 0,
      clipMatch: {
        videoId: result.videoId,
        videoRecordId: result.videoRecordId,
        channelId: result.channelId,
        title: result.title,
        thumbnailUrl: result.thumbnailUrl,
        segmentId: segments[startIndex]?.segment_id ?? startIndex,
        segmentText,
        segmentWords: removeSpecialPunctuationFromPassage(segmentText)
          .split(/\s+/)
          .filter(Boolean),
        highlightStartIndex: null,
        highlightEndIndex: null,
        clipText: segmentText,
        start: segments[startIndex]?.start ?? 0,
        end: segments[endIndex]?.end ?? segments[startIndex]?.end ?? 0,
        anchorTime: segments[startIndex]?.start ?? 0,
        score: 1,
      },
    };
  };

  const runMatchSearch = async () => {
    if (isFindingMatch) return;

    const searchRunId = searchRunIdRef.current + 1;
    searchRunIdRef.current = searchRunId;
    setIsFindingMatch(true);
    setMatchError(null);
    setDifficultyDropdownOpen(false);
    setTopicDropdownOpen(false);

    try {
      const focus = formatTranscriptSearchText(focusQuery);
      let candidateVideos = targetLanguageVideos.filter((video) => {
        const channel = channelById.get(video.channel_id);
        const videoDifficulty = (
          channel?.difficulty ||
          video.difficulty ||
          ""
        ).toLowerCase();
        const difficultyMatches =
          difficulty === "any" || videoDifficulty === difficulty.toLowerCase();
        const topicMatches =
          !topicChannelIds || topicChannelIds.has(video.channel_id);

        return difficultyMatches && topicMatches;
      });

      if (!candidateVideos.length) {
        throw new Error("No videos match those choices.");
      }

      let selectedVideo: Video | null = null;
      let matchedSegmentId: number | null = null;

      if (focus) {
        const candidateVideoIds = candidateVideos
          .map((video) => video.id)
          .filter(Boolean);
        const { data, error } = await publicSupabase
          .from("transcript_segment")
          .select("segment_id,video_id")
          .in("video_id", candidateVideoIds)
          .ilike("text", `%${escapeIlikePattern(focus)}%`)
          .limit(160);

        if (error) {
          console.error(error);
          throw new Error("Failed to search transcript matches");
        }

        const matches = shuffle(
          ((data ?? []) as Pick<Segment, "segment_id" | "video_id">[]).filter(
            (segment) => segment.video_id,
          ),
        );
        const videoByRecordId = new Map(
          candidateVideos.map((video) => [video.id, video]),
        );
        const matchedSegment = matches.find((segment) =>
          videoByRecordId.has(segment.video_id),
        );

        if (!matchedSegment) {
          throw new Error("No transcript excerpts match that focus.");
        }

        selectedVideo = videoByRecordId.get(matchedSegment.video_id) ?? null;
        matchedSegmentId = matchedSegment.segment_id;
      } else {
        candidateVideos = shuffle(candidateVideos);
        selectedVideo = candidateVideos[0] ?? null;
      }

      if (!selectedVideo) {
        throw new Error("Could not choose a matching video.");
      }

      const segments = await loadSegments(selectedVideo.id);
      const nextSuggestion = buildSuggestion(
        selectedVideo,
        segments,
        matchedSegmentId,
      );

      if (!nextSuggestion) {
        throw new Error("No transcript found for that video.");
      }

      if (searchRunIdRef.current === searchRunId) {
        setSuggestion(nextSuggestion);
        onPreviewVideoMatch?.(nextSuggestion.clipMatch);
      }
    } catch (error) {
      if (searchRunIdRef.current === searchRunId) {
        setSuggestion(null);
        onPreviewVideoMatch?.(null);
        setMatchError(
          error instanceof Error
            ? error.message
            : "Could not find a transcript match.",
        );
      }
    } finally {
      if (searchRunIdRef.current === searchRunId) {
        setIsFindingMatch(false);
      }
    }
  };

  const startComposition = () => {
    if (!suggestion) return;
    onChooseVideoTranscriptRange(
      suggestion.result,
      suggestion.segments,
      suggestion.startIndex,
      suggestion.endIndex,
    );
  };

  const showOptions = () => {
    setSuggestion(null);
    onPreviewVideoMatch?.(null);
    setMatchError(null);
  };

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
        <Text style={styles.headerTitle}>Find a Good Match</Text>
        <Text style={styles.headerSubtitle}>
          Choose a level, focus, topic, and passage length.
        </Text>
      </View>

      {!suggestion && (
        <>
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Difficulty</Text>
            <View style={styles.dropdown}>
              <Pressable
                style={styles.dropdownButton}
                onPress={() => {
                  setDifficultyDropdownOpen((isOpen) => !isOpen);
                  setTopicDropdownOpen(false);
                }}
              >
                <Text style={styles.dropdownButtonText}>
                  {difficulty === "any" ? "Any" : titleCase(difficulty)}
                </Text>
                <Ionicons
                  name={difficultyDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#3d3a52"
                />
              </Pressable>
              {difficultyDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {BASE_DIFFICULTY_OPTIONS.map((option) => {
                    const isSelected = difficulty === option;
                    return (
                      <Pressable
                        key={option}
                        style={[
                          styles.dropdownItem,
                          isSelected && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setDifficulty(option);
                          setDifficultyDropdownOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            isSelected && styles.dropdownItemTextSelected,
                          ]}
                        >
                          {option === "any" ? "Any" : titleCase(option)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Practice focus</Text>
            <View style={styles.chipRow}>
              {PRACTICE_OPTIONS.map((option) => {
                const isSelected = practiceType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setPracticeType(option.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={focusQuery}
              onChangeText={setFocusQuery}
              placeholder={
                practiceType === "conjugation"
                  ? "Verb or form to practice"
                  : "Vocabulary or phrase"
              }
              placeholderTextColor="#8a91a3"
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={runMatchSearch}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Topic</Text>
            <View style={styles.dropdown}>
              <Pressable
                style={styles.dropdownButton}
                onPress={() => {
                  setTopicDropdownOpen((isOpen) => !isOpen);
                  setDifficultyDropdownOpen(false);
                }}
                disabled={isLoadingTopics}
              >
                <Text style={styles.dropdownButtonText} numberOfLines={1}>
                  {isLoadingTopics
                    ? "Loading topics..."
                    : selectedTopic?.description || "Any topic"}
                </Text>
                {isLoadingTopics ? (
                  <ActivityIndicator size="small" color="#5a5680" />
                ) : (
                  <Ionicons
                    name={topicDropdownOpen ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#3d3a52"
                  />
                )}
              </Pressable>
              {topicDropdownOpen && !isLoadingTopics && (
                <View style={styles.dropdownMenu}>
                  <ScrollView
                    style={styles.topicMenuScroll}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    <Pressable
                      style={[
                        styles.dropdownItem,
                        selectedTopicId === null && styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedTopicId(null);
                        setTopicDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          selectedTopicId === null &&
                            styles.dropdownItemTextSelected,
                        ]}
                      >
                        Any topic
                      </Text>
                    </Pressable>
                    {topics.map((topic) => {
                      const isSelected = selectedTopicId === topic.id;
                      return (
                        <Pressable
                          key={topic.id}
                          style={[
                            styles.dropdownItem,
                            isSelected && styles.dropdownItemSelected,
                          ]}
                          onPress={() => {
                            setSelectedTopicId(topic.id);
                            setTopicDropdownOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              isSelected && styles.dropdownItemTextSelected,
                            ]}
                          >
                            {topic.description}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              {topicError && (
                <Text style={styles.fieldError}>{topicError}</Text>
              )}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Paragraphs</Text>
            <View style={styles.chipRow}>
              {PARAGRAPH_OPTIONS.map((option) => {
                const isSelected = paragraphCount === option;
                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.countChip,
                      isSelected && styles.chipSelected,
                    ]}
                    onPress={() => setParagraphCount(option)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            style={[
              styles.findButton,
              isFindingMatch && styles.findButtonDisabled,
            ]}
            onPress={runMatchSearch}
            disabled={isFindingMatch}
          >
            {isFindingMatch ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="sparkles-outline" size={16} color="#ffffff" />
            )}
            <Text style={styles.findButtonText}>Find Match</Text>
          </Pressable>
        </>
      )}

      {matchError && <Text style={styles.errorText}>{matchError}</Text>}

      {suggestion && (
        <View style={styles.resultSection}>
          <View style={styles.videoRow}>
            <Image
              source={{ uri: suggestion.result.thumbnailUrl ?? "" }}
              style={styles.videoThumbnail}
            />
            <View style={styles.videoTextGroup}>
              <Text style={styles.videoTitle} numberOfLines={2}>
                {suggestion.result.title}
              </Text>
              <Text style={styles.videoMeta} numberOfLines={1}>
                {suggestion.result.channelTitle}
              </Text>
              <Text style={styles.videoTime} numberOfLines={1}>
                {formatTimestamp(suggestion.startTime)} -{" "}
                {formatTimestamp(suggestion.endTime)}
              </Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {titleCase(suggestion.difficultyLabel)}
                  </Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {titleCase(suggestion.topicLabel)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.excerptText}>{suggestion.excerptText}</Text>

          <View style={styles.resultActions}>
            <Pressable
              style={[styles.resultButton, styles.secondaryButton]}
              onPress={showOptions}
              disabled={isFindingMatch}
            >
              <Ionicons name="options-outline" size={15} color="#3d3a52" />
              <Text style={styles.secondaryButtonText}>Options</Text>
            </Pressable>
            <Pressable
              style={[styles.resultButton, styles.secondaryButton]}
              onPress={runMatchSearch}
              disabled={isFindingMatch}
            >
              <Ionicons name="refresh" size={15} color="#3d3a52" />
              <Text style={styles.secondaryButtonText}>Regenerate</Text>
            </Pressable>
            <Pressable
              style={[styles.resultButton, styles.primaryButton]}
              onPress={startComposition}
            >
              <Ionicons name="create-outline" size={15} color="#ffffff" />
              <Text style={styles.primaryButtonText}>Start Composition</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 18,
    gap: 12,
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
    gap: 4,
  },
  headerTitle: {
    color: "#2f3140",
    fontSize: 16,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#697187",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
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
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
    backgroundColor: "#ffffff",
  },
  countChip: {
    minWidth: 40,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
    backgroundColor: "#ffffff",
  },
  chipSelected: {
    backgroundColor: "#edf4f2",
    borderColor: "#26705d",
  },
  chipText: {
    color: "#3d3a52",
    fontSize: 12,
    fontWeight: "800",
  },
  chipTextSelected: {
    color: "#26705d",
    fontWeight: "900",
  },
  input: {
    minHeight: 42,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.16)",
    color: "#2f3140",
    fontSize: 14,
    fontWeight: "700",
    outlineStyle: "none" as any,
  },
  dropdown: {
    position: "relative",
    zIndex: 3,
  },
  dropdownButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.16)",
    backgroundColor: "#ffffff",
  },
  dropdownButtonText: {
    flex: 1,
    minWidth: 0,
    color: "#2f3140",
    fontSize: 14,
    fontWeight: "800",
  },
  dropdownMenu: {
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  topicMenuScroll: {
    maxHeight: 190,
  },
  dropdownItem: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(74, 105, 189, 0.08)",
  },
  dropdownItemSelected: {
    backgroundColor: "#edf4f2",
  },
  dropdownItemText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "800",
  },
  dropdownItemTextSelected: {
    color: "#26705d",
    fontWeight: "900",
  },
  fieldError: {
    marginTop: 6,
    color: "#9f3c3c",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
  },
  findButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#3d3a52",
  },
  findButtonDisabled: {
    opacity: 0.58,
  },
  findButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  errorText: {
    color: "#9f3c3c",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
  },
  resultSection: {
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 105, 189, 0.12)",
  },
  videoRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  videoThumbnail: {
    width: 92,
    height: 52,
    borderRadius: 6,
    backgroundColor: "#d8dee9",
  },
  videoTextGroup: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  videoTitle: {
    color: "#2f3140",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  videoMeta: {
    color: "#697187",
    fontSize: 11,
    fontWeight: "800",
  },
  videoTime: {
    color: "#26705d",
    fontSize: 11,
    fontWeight: "900",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    minHeight: 18,
    justifyContent: "center",
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: "#f4f0df",
  },
  badgeText: {
    color: "#6a5a16",
    fontSize: 10,
    fontWeight: "900",
  },
  excerptText: {
    color: "#2f3140",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  resultActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
  },
  resultButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 8,
    paddingHorizontal: 14,
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
});

export default FindVideoMatch;
