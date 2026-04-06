import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-expo";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import { RootState, Sentence } from "../../types";
import { calculateAccuracy } from "../../helpers/calculate_accuracy";
import { supabase as globalSupabase } from "../../../lib/supabase";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { YouTubePlayerHandle } from "../common/YouTubePlayer";

interface ShadowResult {
  sentence: number;
  recording_id: string;
  spoken_words: string;
  recording_speed: number | null;
}

type ListItem =
  | { type: "recording"; data: ShadowResult; accuracy: number }
  | { type: "gap"; startSegment: number; endSegment: number };

interface RecordingsTabProps {
  time: number;
  isActive: boolean;
  playerRef: React.RefObject<YouTubePlayerHandle | null>;
  pausePlayer: () => void;
  resumePlayer: () => void;
  setPlayerSpeed: (speed: number) => void;
  onShowVideo: (show: boolean) => void;
  playerIsPlaying: boolean;
  onNavigateToShadow: (sentenceIndex: number) => void;
}

const RecordingsTab: React.FC<RecordingsTabProps> = ({
  time,
  isActive,
  playerRef,
  pausePlayer,
  resumePlayer,
  setPlayerSpeed,
  onShowVideo,
  playerIsPlaying,
  onNavigateToShadow,
}) => {
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  const [recordings, setRecordings] = useState<ShadowResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [isLoadingPlayback, setIsLoadingPlayback] = useState(false);

  // Playback state refs
  const preloadedPlayers = useRef<Map<number, AudioPlayer>>(new Map());
  const playbackRecordings = useRef<ShadowResult[]>([]);
  const currentPlaybackIndex = useRef(0);
  const startedPlaybackIndex = useRef(-1); // guard: which index we've already triggered
  const isPlayingRef = useRef(false);
  const waitingForVideoStart = useRef(false);
  const currentAudioPlayer = useRef<AudioPlayer | null>(null);
  const currentSubscription = useRef<{ remove: () => void } | null>(null);
  const playbackSpeedRef = useRef(1);
  const timeRef = useRef(time);
  timeRef.current = time;
  const flatListRef = useRef<FlatList>(null);

  const sentences = currentVideo?.sentences ?? [];

  // Fetch all recordings for this video
  useEffect(() => {
    if (!isActive) return;
    fetchRecordings();
  }, [isActive, currentVideo?.recordId]);

  const fetchRecordings = async () => {
    if (!supabase || !userId || !currentVideo) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_shadow_result")
        .select("sentence, recording_id, spoken_words, recording_speed")
        .eq("user_id", userId)
        .eq("video_id", parseInt(currentVideo.recordId))
        .not("recording_id", "is", null)
        .order("sentence", { ascending: true });

      if (error) {
        console.error("Failed to fetch recordings:", error);
        return;
      }
      setRecordings(data ?? []);
    } catch (err) {
      console.error("Error fetching recordings:", err);
    } finally {
      setLoading(false);
    }
  };

  // Build the ordered list with gap cards
  const listItems: ListItem[] = React.useMemo(() => {
    if (sentences.length === 0) return [];

    const items: ListItem[] = [];
    const recordedSet = new Map<number, ShadowResult>();
    for (const r of recordings) {
      recordedSet.set(r.sentence, r);
    }

    let gapStart: number | null = null;

    for (let i = 0; i < sentences.length; i++) {
      const rec = recordedSet.get(i);
      if (rec) {
        // Close any open gap
        if (gapStart !== null) {
          items.push({
            type: "gap",
            startSegment: gapStart,
            endSegment: i - 1,
          });
          gapStart = null;
        }
        // Calculate accuracy
        const spokenWords = rec.spoken_words
          ? rec.spoken_words.split(/\s+/).filter(Boolean)
          : [];
        const targetWords = sentences[i].text.split(/\s+/).filter(Boolean);
        const result = calculateAccuracy(spokenWords, targetWords);
        items.push({
          type: "recording",
          data: rec,
          accuracy: Math.round(result.percentage),
        });
      } else {
        if (gapStart === null) {
          gapStart = i;
        }
      }
    }

    // Close trailing gap
    if (gapStart !== null) {
      items.push({
        type: "gap",
        startSegment: gapStart,
        endSegment: sentences.length - 1,
      });
    }

    return items;
  }, [recordings, sentences]);

  const listItemsRef = useRef(listItems);
  listItemsRef.current = listItems;

  const scrollToRecording = useCallback((sentenceIndex: number) => {
    const idx = listItemsRef.current.findIndex(
      (item) =>
        item.type === "recording" && item.data.sentence === sentenceIndex,
    );
    if (idx >= 0 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0,
      });
    }
  }, []);

  // Wait for video to actually start playing before triggering the first recording
  useEffect(() => {
    if (waitingForVideoStart.current && playerIsPlaying) {
      waitingForVideoStart.current = false;
      startedPlaybackIndex.current = 0;
      playRecordingAtIndex(0);
    }
  }, [playerIsPlaying]);

  // Stop playback if the video player stops (debounced to ignore brief blips
  // from speed changes which momentarily report playerIsPlaying=false)
  const stopDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!playerIsPlaying && isPlayingRef.current) {
      stopDebounceRef.current = setTimeout(() => {
        if (!playerIsPlaying && isPlayingRef.current) {
          stopPlaybackAll();
        }
      }, 500);
    } else if (stopDebounceRef.current) {
      clearTimeout(stopDebounceRef.current);
      stopDebounceRef.current = null;
    }
    return () => {
      if (stopDebounceRef.current) {
        clearTimeout(stopDebounceRef.current);
      }
    };
  }, [playerIsPlaying]);

  // Clean up audio players on unmount
  useEffect(() => {
    return () => {
      cleanupPlayers();
    };
  }, []);

  const cleanupPlayers = () => {
    for (const player of preloadedPlayers.current.values()) {
      player.remove();
    }
    preloadedPlayers.current.clear();
    currentAudioPlayer.current = null;
  };

  // Monitor video time to trigger recordings at the right moment
  useEffect(() => {
    if (!isPlayingRef.current || !currentVideo) return;

    const recs = playbackRecordings.current;
    const idx = currentPlaybackIndex.current;
    if (idx >= recs.length) return;

    const rec = recs[idx];
    const sentence = sentences[rec.sentence];
    if (!sentence) return;

    // Don't re-trigger the same index
    if (idx === startedPlaybackIndex.current) return;

    // When video time reaches (or passes) this segment's start, play the recording
    if (time >= sentence.start - 0.15) {
      startedPlaybackIndex.current = idx;
      playRecordingAtIndex(idx);
    }
  }, [time]);

  const playRecordingAtIndex = (idx: number) => {
    const recs = playbackRecordings.current;
    if (idx >= recs.length) {
      stopPlaybackAll();
      return;
    }

    const rec = recs[idx];
    const player = preloadedPlayers.current.get(rec.sentence);
    if (!player) {
      // Skip to next if player missing
      currentPlaybackIndex.current = idx + 1;
      advanceToNextRecording(idx + 1);
      return;
    }

    scrollToRecording(rec.sentence);

    const speed = rec.recording_speed ?? 1;
    if (speed !== playbackSpeedRef.current) {
      playbackSpeedRef.current = speed;
      setPlayerSpeed(speed);
    }

    // Stop previous audio and clean up subscription
    if (currentSubscription.current) {
      currentSubscription.current.remove();
      currentSubscription.current = null;
    }
    if (currentAudioPlayer.current && currentAudioPlayer.current !== player) {
      currentAudioPlayer.current.pause();
    }
    currentAudioPlayer.current = player;

    player.seekTo(0);
    player.play();
    playerRef.current?.play();

    const subscription = player.addListener(
      "playbackStatusUpdate",
      (status) => {
        if (status.didJustFinish) {
          subscription.remove();
          currentSubscription.current = null;
          currentPlaybackIndex.current = idx + 1;
          advanceToNextRecording(idx + 1);
        }
      },
    );
    currentSubscription.current = subscription;
  };

  const advanceToNextRecording = (nextIdx: number) => {
    const recs = playbackRecordings.current;
    if (nextIdx >= recs.length) {
      stopPlaybackAll();
      return;
    }

    const nextRec = recs[nextIdx];
    const nextSentence = sentences[nextRec.sentence];
    if (!nextSentence) {
      stopPlaybackAll();
      return;
    }

    // Set video speed for the next recording
    const speed = nextRec.recording_speed ?? 1;
    if (speed !== playbackSpeedRef.current) {
      playbackSpeedRef.current = speed;
      setPlayerSpeed(speed);
    }

    // Check if the next segment is non-contiguous — need to seek
    const prevRec = recs[nextIdx - 1];
    if (prevRec && nextRec.sentence !== prevRec.sentence + 1) {
      playerRef.current?.seekTo(nextSentence.start);
    }

    // If video time is already at or past the next segment's start,
    // play immediately instead of waiting for the time effect
    if (timeRef.current >= nextSentence.start - 0.15) {
      startedPlaybackIndex.current = nextIdx;
      playRecordingAtIndex(nextIdx);
    }
    // Otherwise the time effect will trigger playRecordingAtIndex when time >= start
  };

  const handlePlaybackAll = async () => {
    if (recordings.length === 0) return;

    setIsLoadingPlayback(true);
    cleanupPlayers();

    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      // Create signed URLs and preload all recordings
      const loadPromises = recordings.map(async (rec) => {
        const { data, error } = await globalSupabase.storage
          .from("shadow_recordings")
          .createSignedUrl(rec.recording_id, 300);

        if (error || !data?.signedUrl) {
          console.warn(`Failed to get URL for segment ${rec.sentence}`);
          return;
        }

        const player = createAudioPlayer({ uri: data.signedUrl });
        preloadedPlayers.current.set(rec.sentence, player);
      });

      await Promise.all(loadPromises);

      if (preloadedPlayers.current.size === 0) {
        console.error("No recordings could be loaded");
        setIsLoadingPlayback(false);
        return;
      }

      // Start playback
      playbackRecordings.current = recordings;
      currentPlaybackIndex.current = 0;
      startedPlaybackIndex.current = -1;
      isPlayingRef.current = true;
      setIsPlayingAll(true);
      setIsLoadingPlayback(false);
      activateKeepAwakeAsync("recordings-playback");

      // Show video and disable clip enforcement so video plays freely across segments
      onShowVideo(true);
      playerRef.current?.disableClipEnforcement();

      const firstSpeed = recordings[0].recording_speed ?? 1;
      playbackSpeedRef.current = firstSpeed;
      setPlayerSpeed(firstSpeed);

      // Seek to the first recorded segment but don't play yet —
      // playRecordingAtIndex will start both video and audio together
      const firstSentence = sentences[recordings[0].sentence];
      if (firstSentence) {
        playerRef.current?.seekTo(firstSentence.start);
        // Wait for video to start playing before triggering the first recording
        waitingForVideoStart.current = true;
        playerRef.current?.play();
      }
    } catch (err) {
      console.error("Error loading recordings for playback:", err);
      setIsLoadingPlayback(false);
    }
  };

  const stopPlaybackAll = () => {
    isPlayingRef.current = false;
    startedPlaybackIndex.current = -1;
    waitingForVideoStart.current = false;
    setIsPlayingAll(false);
    deactivateKeepAwake("recordings-playback");

    if (currentSubscription.current) {
      currentSubscription.current.remove();
      currentSubscription.current = null;
    }
    if (currentAudioPlayer.current) {
      currentAudioPlayer.current.pause();
      currentAudioPlayer.current = null;
    }

    // Reset video speed and hide video
    setPlayerSpeed(1);
    playbackSpeedRef.current = 1;
    pausePlayer();
    onShowVideo(false);
    cleanupPlayers();
  };

  const playFromRecording = async (rec: ShadowResult) => {
    if (isPlayingAll) stopPlaybackAll();
    cleanupPlayers();

    const startIndex = recordings.findIndex((r) => r.sentence === rec.sentence);
    if (startIndex === -1) return;
    const remainingRecordings = recordings.slice(startIndex);

    const sentence = sentences[rec.sentence];
    if (!sentence) return;

    setIsLoadingPlayback(true);
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      // Preload all remaining recordings
      const loadPromises = remainingRecordings.map(async (r) => {
        const { data, error } = await globalSupabase.storage
          .from("shadow_recordings")
          .createSignedUrl(r.recording_id, 300);

        if (error || !data?.signedUrl) {
          console.warn(`Failed to get URL for segment ${r.sentence}`);
          return;
        }

        const player = createAudioPlayer({ uri: data.signedUrl });
        preloadedPlayers.current.set(r.sentence, player);
      });

      await Promise.all(loadPromises);

      if (preloadedPlayers.current.size === 0) {
        setIsLoadingPlayback(false);
        return;
      }

      playbackRecordings.current = remainingRecordings;
      currentPlaybackIndex.current = 0;
      startedPlaybackIndex.current = -1;
      isPlayingRef.current = true;
      setIsPlayingAll(true);
      setIsLoadingPlayback(false);
      activateKeepAwakeAsync("recordings-playback");

      onShowVideo(true);
      playerRef.current?.disableClipEnforcement();

      const speed = rec.recording_speed ?? 1;
      playbackSpeedRef.current = speed;
      setPlayerSpeed(speed);

      playerRef.current?.seekTo(sentence.start);
      // Wait for video to start playing before triggering the first recording
      waitingForVideoStart.current = true;
      playerRef.current?.play();
    } catch (err) {
      console.error("Error playing from recording:", err);
      setIsLoadingPlayback(false);
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return "#4CAF50";
    if (accuracy >= 50) return "#FF9800";
    return "#f44336";
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "gap") {
      const label =
        item.startSegment === item.endSegment
          ? `No recording yet for Segment ${item.startSegment + 1}`
          : `No recordings yet for Segments ${item.startSegment + 1}-${item.endSegment + 1}`;
      return (
        <View style={styles.gapCard}>
          <MaterialIcons name="more-horiz" size={18} color="#bbb" />
          <Text style={styles.gapText}>{label}</Text>
        </View>
      );
    }

    const { data, accuracy } = item;
    const sentence = sentences[data.sentence];
    const isActive =
      isPlayingRef.current &&
      sentence &&
      time >= sentence.start &&
      time <= sentence.end;
    const speedLabel =
      data.recording_speed && data.recording_speed !== 1
        ? ` @ ${data.recording_speed}x`
        : "";

    return (
      <TouchableOpacity
        style={[styles.recordingCard, isActive && styles.recordingCardActive]}
        onPress={() => playFromRecording(data)}
        activeOpacity={0.7}
      >
        <View style={styles.segmentBadge}>
          <Text style={styles.segmentNumber}>{data.sentence + 1}</Text>
        </View>
        <Text style={styles.recordingLabel} numberOfLines={1}>
          Segment {data.sentence + 1}
          {speedLabel}
        </Text>
        <Text
          style={[styles.accuracyText, { color: getAccuracyColor(accuracy) }]}
        >
          {accuracy}%
        </Text>
        <TouchableOpacity
          style={styles.shadowNavButton}
          onPress={() => onNavigateToShadow(data.sentence)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="open-in-new" size={16} color="#888" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (!currentVideo) return null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3d3a52" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isPlayingAll ? (
        <TouchableOpacity
          style={styles.playbackButton}
          onPress={stopPlaybackAll}
        >
          <MaterialIcons name="stop" size={22} color="white" />
          <Text style={styles.playbackButtonText}>Stop Playback</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.instructionText}>
          Tap on a segment to hear a recording stream from that point
        </Text>
      )}

      {recordings.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons name="mic-off" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No recordings yet</Text>
          <Text style={styles.emptySubtext}>
            Record segments in Shadow mode to see them here
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={listItems}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            item.type === "recording"
              ? `rec-${item.data.sentence}`
              : `gap-${index}`
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0,
              });
            }, 100);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  playbackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3d3a52",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  instructionText: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  playbackButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  recordingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f4f8",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
    gap: 10,
  },
  recordingCardActive: {
    backgroundColor: "#e8f5e9",
  },
  segmentBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3d3a52",
    justifyContent: "center",
    alignItems: "center",
  },
  segmentNumber: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  recordingLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#3d3a52",
  },
  accuracyText: {
    fontSize: 15,
    fontWeight: "700",
  },
  shadowNavButton: {
    padding: 4,
  },
  gapCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
    gap: 8,
  },
  gapText: {
    fontSize: 13,
    color: "#bbb",
    fontStyle: "italic",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
  },
  emptySubtext: {
    fontSize: 13,
    color: "#bbb",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});

export default RecordingsTab;
