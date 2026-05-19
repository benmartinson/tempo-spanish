import React, { useMemo, useRef, useState } from "react";
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
import type { Channel, Segment, Video } from "../../types";
import VideoList from "../video-list/VideoList";
import { escapeIlikePattern, formatTranscriptSearchText } from "./helpers";

export interface VideoTranscriptSearchResult {
  videoId: string;
  videoRecordId: string;
  channelId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl?: string | null;
  matchedSegmentId?: number | null;
}

interface VideoTranscriptImportProps {
  allChannels: Channel[];
  publicSupabase: any;
  targetLanguageVideos: Video[];
  onBack: () => void;
  onFindGoodMatch: () => void;
  onChooseVideoTranscript: (
    result: VideoTranscriptSearchResult,
    segments: Segment[],
  ) => void;
}

const VideoTranscriptImport: React.FC<VideoTranscriptImportProps> = ({
  allChannels,
  publicSupabase,
  targetLanguageVideos,
  onBack,
  onFindGoodMatch,
  onChooseVideoTranscript,
}) => {
  const [topicQuery, setTopicQuery] = useState("");
  const [channelQuery, setChannelQuery] = useState("");
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [libraryChannelId, setLibraryChannelId] = useState<string | null>(null);
  const [videoResults, setVideoResults] = useState<
    VideoTranscriptSearchResult[]
  >([]);
  const [isSearchingVideos, setIsSearchingVideos] = useState(false);
  const [loadingTranscriptVideoId, setLoadingTranscriptVideoId] = useState<
    string | null
  >(null);
  const [videoSearchError, setVideoSearchError] = useState<string | null>(null);
  const [hasSearchedVideos, setHasSearchedVideos] = useState(false);
  const searchRunIdRef = useRef(0);

  const channelById = useMemo(
    () => new Map(allChannels.map((channel) => [channel.channel_id, channel])),
    [allChannels],
  );
  const hasVideoSearchInput = Boolean(
    topicQuery.trim() || channelQuery.trim() || transcriptQuery.trim(),
  );

  const runVideoSearch = async () => {
    if (!hasVideoSearchInput || isSearchingVideos) return;

    const searchRunId = searchRunIdRef.current + 1;
    searchRunIdRef.current = searchRunId;
    setIsSearchingVideos(true);
    setVideoSearchError(null);
    setHasSearchedVideos(true);

    try {
      const topic = topicQuery.trim().toLowerCase();
      const channel = channelQuery.trim().toLowerCase();
      const transcript = formatTranscriptSearchText(transcriptQuery);
      let candidateVideos = targetLanguageVideos.filter((video) => {
        const channelTitle =
          channelById.get(video.channel_id)?.title.toLowerCase() ?? "";
        const topicMatches =
          !topic || video.title.toLowerCase().includes(topic);
        const channelMatches = !channel || channelTitle.includes(channel);
        return topicMatches && channelMatches;
      });
      const matchedSegmentByVideoId = new Map<string, number>();

      if (transcript) {
        const candidateVideoIds = candidateVideos
          .map((video) => video.id)
          .filter(Boolean);

        if (!candidateVideoIds.length) {
          if (searchRunIdRef.current === searchRunId) setVideoResults([]);
          return;
        }

        const { data, error } = await publicSupabase
          .from("transcript_segment")
          .select("segment_id,video_id")
          .in("video_id", candidateVideoIds)
          .ilike("text", `%${escapeIlikePattern(transcript)}%`)
          .limit(120);

        if (error) {
          console.error(error);
          throw new Error("Failed to search video transcripts");
        }

        for (const segment of (data ?? []) as Pick<
          Segment,
          "segment_id" | "video_id"
        >[]) {
          if (!matchedSegmentByVideoId.has(segment.video_id)) {
            matchedSegmentByVideoId.set(segment.video_id, segment.segment_id);
          }
        }

        candidateVideos = candidateVideos.filter((video) =>
          matchedSegmentByVideoId.has(video.id),
        );
      }

      if (searchRunIdRef.current === searchRunId) {
        setVideoResults(
          candidateVideos.slice(0, 30).map((video) => {
            const channelRecord = channelById.get(video.channel_id);
            return {
              videoId: video.video_id,
              videoRecordId: video.id,
              channelId: video.channel_id,
              title: video.title,
              channelTitle: channelRecord?.title ?? "Tempo channel",
              thumbnailUrl: video.thumbnail_url,
              matchedSegmentId: matchedSegmentByVideoId.get(video.id) ?? null,
            };
          }),
        );
      }
    } catch {
      if (searchRunIdRef.current === searchRunId) {
        setVideoResults([]);
        setVideoSearchError("Video search is unavailable.");
      }
    } finally {
      if (searchRunIdRef.current === searchRunId) {
        setIsSearchingVideos(false);
      }
    }
  };

  const handleSearchInputSubmit = () => {
    if (!hasVideoSearchInput || isSearchingVideos) return;
    void runVideoSearch();
  };

  const cancelVideoSearch = () => {
    searchRunIdRef.current += 1;
    setTopicQuery("");
    setChannelQuery("");
    setTranscriptQuery("");
    setVideoResults([]);
    setVideoSearchError(null);
    setHasSearchedVideos(false);
    setIsSearchingVideos(false);
  };

  const loadVideoTranscript = async (result: VideoTranscriptSearchResult) => {
    if (loadingTranscriptVideoId) return;
    setLoadingTranscriptVideoId(result.videoRecordId);
    setVideoSearchError(null);

    try {
      const { data, error } = await publicSupabase
        .from("transcript_segment")
        .select("segment_id,start,end,text,video_id,words")
        .eq("video_id", result.videoRecordId)
        .order("segment_id");

      if (error) {
        console.error(error);
        throw new Error("Failed to load transcript segments");
      }

      const segments = ((data ?? []) as Segment[]).filter((segment) =>
        Boolean(segment.text?.trim()),
      );
      if (!segments.length) {
        setVideoSearchError("No transcript found for that video.");
        return;
      }

      onChooseVideoTranscript(result, segments);
    } catch {
      setVideoSearchError("Could not load that transcript.");
    } finally {
      setLoadingTranscriptVideoId(null);
    }
  };

  const loadLibraryVideoTranscript = (videoRecordId: string) => {
    const video = targetLanguageVideos.find(
      (targetVideo) => String(targetVideo.id) === String(videoRecordId),
    );

    if (!video) {
      setVideoSearchError("Could not find that video.");
      return;
    }

    const channelRecord = channelById.get(video.channel_id);
    loadVideoTranscript({
      videoId: video.video_id,
      videoRecordId: video.id,
      channelId: video.channel_id,
      title: video.title,
      channelTitle: channelRecord?.title ?? "Tempo channel",
      thumbnailUrl: video.thumbnail_url,
      matchedSegmentId: null,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={16} color="#3d3a52" />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Video Transcript Library</Text>
            <Pressable
              style={styles.matchButton}
              onPress={onFindGoodMatch}
              accessibilityRole="button"
            >
              <Ionicons name="sparkles-outline" size={15} color="#26705d" />
              <Text style={styles.matchButtonText}>Find a Good Match</Text>
            </Pressable>
          </View>
          <Text style={styles.headerSubtitle}>
            Search directly, or browse the library below.
          </Text>
        </View>

        <View style={styles.searchFields}>
          <View style={styles.searchInputRow}>
            <TextInput
              value={topicQuery}
              onChangeText={setTopicQuery}
              placeholder="Topic"
              placeholderTextColor="#8a91a3"
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={handleSearchInputSubmit}
            />
            <TextInput
              value={channelQuery}
              onChangeText={setChannelQuery}
              placeholder="Channel"
              placeholderTextColor="#8a91a3"
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={handleSearchInputSubmit}
            />
            <TextInput
              value={transcriptQuery}
              onChangeText={setTranscriptQuery}
              placeholder="Transcript includes"
              placeholderTextColor="#8a91a3"
              style={[styles.searchInput, styles.transcriptSearchInput]}
              returnKeyType="search"
              onSubmitEditing={handleSearchInputSubmit}
            />
            <Pressable
              style={[
                styles.searchButton,
                (!hasVideoSearchInput || isSearchingVideos) &&
                  styles.searchButtonDisabled,
              ]}
              onPress={runVideoSearch}
              disabled={!hasVideoSearchInput || isSearchingVideos}
            >
              {isSearchingVideos ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="search" size={16} color="#ffffff" />
              )}
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>
          </View>
          {(hasSearchedVideos || isSearchingVideos) && (
            <Pressable
              style={styles.cancelSearchButton}
              onPress={cancelVideoSearch}
            >
              <Ionicons name="close" size={15} color="#3d3a52" />
              <Text style={styles.cancelSearchButtonText}>Reset</Text>
            </Pressable>
          )}
        </View>

        {videoSearchError ? (
          <Text style={styles.emptyText}>{videoSearchError}</Text>
        ) : hasSearchedVideos && !videoResults.length && !isSearchingVideos ? (
          <Text style={styles.emptyText}>No matching videos found.</Text>
        ) : null}

        {videoResults.length > 0 && (
          <ScrollView
            style={styles.videoResultsScroll}
            contentContainerStyle={styles.videoList}
            showsVerticalScrollIndicator
          >
            {videoResults.map((result) => (
              <Pressable
                key={result.videoRecordId}
                style={styles.videoCard}
                onPress={() => loadVideoTranscript(result)}
                disabled={Boolean(loadingTranscriptVideoId)}
              >
                <Image
                  source={{ uri: result.thumbnailUrl ?? "" }}
                  style={styles.videoThumbnail}
                />
                <View style={styles.videoTextGroup}>
                  <Text style={styles.videoTitle} numberOfLines={2}>
                    {result.title}
                  </Text>
                  <Text style={styles.videoChannel} numberOfLines={1}>
                    {result.channelTitle}
                  </Text>
                </View>
                {loadingTranscriptVideoId === result.videoRecordId ? (
                  <ActivityIndicator size="small" color="#5a5680" />
                ) : (
                  <Ionicons name="arrow-forward" size={17} color="#3d3a52" />
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {!hasSearchedVideos && (
        <View style={styles.libraryContainer}>
          <VideoList
            compact
            selectionMode="composition"
            routeChannelId={libraryChannelId}
            onNavigateHome={() => setLibraryChannelId(null)}
            onNavigateChannel={setLibraryChannelId}
            onNavigateComposition={loadLibraryVideoTranscript}
          />
        </View>
      )}
    </View>
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
    paddingBottom: 10,
    gap: 10,
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
  emptyText: {
    color: "#697187",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  searchFields: {
    gap: 8,
  },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  header: {
    gap: 4,
  },
  headerTitleRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    color: "#2f3140",
    fontSize: 16,
    fontWeight: "900",
  },
  matchButton: {
    flexShrink: 0,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#edf4f2",
    borderWidth: 1,
    borderColor: "rgba(38, 112, 93, 0.2)",
  },
  matchButtonText: {
    color: "#26705d",
    fontSize: 12,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#697187",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  inlineLink: {
    color: "#26705d",
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.16)",
    color: "#2f3140",
    fontSize: 14,
    fontWeight: "700",
    outlineStyle: "none" as any,
  },
  transcriptSearchInput: {
    flex: 1.35,
  },
  searchButton: {
    flexShrink: 0,
    minWidth: 120,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#3d3a52",
  },
  searchButtonDisabled: {
    opacity: 0.42,
  },
  searchButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  cancelSearchButton: {
    minHeight: 32,
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
  },
  cancelSearchButtonText: {
    color: "#3d3a52",
    fontSize: 12,
    fontWeight: "900",
  },
  videoList: {
    gap: 8,
  },
  videoResultsScroll: {
    maxHeight: 210,
  },
  videoCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(74, 105, 189, 0.12)",
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
  },
  videoTitle: {
    color: "#2f3140",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  videoChannel: {
    marginTop: 4,
    color: "#697187",
    fontSize: 11,
    fontWeight: "800",
  },
  libraryContainer: {
    flex: 1,
    minHeight: 260,
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 105, 189, 0.12)",
  },
});

export default VideoTranscriptImport;
