import React, { RefObject, useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { TranscriptPhraseMatch } from "../../requests";
import { Sentence } from "../../types";
import YouTubePlayer, { YouTubePlayerHandle } from "../common/YouTubePlayer";
import PlayerControls from "../shadow/PlayerControls";

interface ClipMatcherProps {
  matches: TranscriptPhraseMatch[];
  selectedMatch: TranscriptPhraseMatch | null;
  selectedMatchIndex: number;
  previousMatch: TranscriptPhraseMatch | null;
  nextMatch: TranscriptPhraseMatch | null;
  selectedMatchPhrase: string;
  isSearchingPhrase: boolean;
  phraseError: string | null;
  playerRef: RefObject<YouTubePlayerHandle | null>;
  playerRefreshKey: number;
  playerTime: number;
  playerIsPlaying: boolean;
  channelTitleById: Map<string, string>;
  onSetPlayerTime: (time: number) => void;
  onSetPlayerIsPlaying: (isPlaying: boolean) => void;
  onPlayMatch: (match: TranscriptPhraseMatch) => void;
  onReplaySelectedMatch: (speed?: number) => void;
  onToggleMatchPlayback: () => void;
  onOpenSelectedVideo: () => void;
}

const makeClipSentence = (match: TranscriptPhraseMatch): Sentence => ({
  index: match.segmentId,
  start: match.start,
  end: match.end,
  text: match.clipText,
  words: [],
});

const ClipMatcher: React.FC<ClipMatcherProps> = ({
  matches,
  selectedMatch,
  selectedMatchIndex,
  previousMatch,
  nextMatch,
  selectedMatchPhrase,
  isSearchingPhrase,
  phraseError,
  playerRef,
  playerRefreshKey,
  playerTime,
  playerIsPlaying,
  channelTitleById,
  onSetPlayerTime,
  onSetPlayerIsPlaying,
  onPlayMatch,
  onReplaySelectedMatch,
  onToggleMatchPlayback,
  onOpenSelectedVideo,
}) => {
  const segmentTranscript = useMemo(() => {
    if (!selectedMatch) return null;

    const words = selectedMatch.segmentWords.length
      ? selectedMatch.segmentWords
      : selectedMatch.segmentText.split(/\s+/).filter(Boolean);

    return words.map((word, index) => {
      const isHighlighted =
        selectedMatch.highlightStartIndex !== null &&
        selectedMatch.highlightEndIndex !== null &&
        index >= selectedMatch.highlightStartIndex &&
        index <= selectedMatch.highlightEndIndex;

      return (
        <Text
          key={`${word}-${index}`}
          style={isHighlighted && styles.segmentTranscriptWordActive}
        >
          {word}
          {index < words.length - 1 ? " " : ""}
        </Text>
      );
    });
  }, [selectedMatch]);

  return (
    <View style={styles.clipColumn}>
      <View style={styles.videoPane}>
        <View style={[styles.paneHeader, styles.videoPaneHeader]}>
          <Text style={styles.paneTitle}>Clip Match</Text>
          {isSearchingPhrase && (
            <ActivityIndicator size="small" color="#5a5680" />
          )}
        </View>

        {selectedMatch ? (
          <>
            <View style={styles.playerShell}>
              <YouTubePlayer
                ref={playerRef}
                videoId={selectedMatch.videoId}
                clip={makeClipSentence(selectedMatch)}
                autoplay
                refreshKey={playerRefreshKey}
                setTime={onSetPlayerTime}
                startTime={playerTime}
                videoText={selectedMatchPhrase}
                onPlayingStateChange={onSetPlayerIsPlaying}
                webCropMode="narrow"
              />
            </View>
            <View style={styles.matchTitleRow}>
              <View style={styles.matchTitleTextGroup}>
                <Text style={styles.matchTitle} numberOfLines={1}>
                  {selectedMatch.title}
                </Text>
                <Text style={styles.matchChannel} numberOfLines={1}>
                  {channelTitleById.get(selectedMatch.channelId) ??
                    "Tempo clip"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.openVideoButton}
                onPress={onOpenSelectedVideo}
                activeOpacity={0.76}
              >
                <Ionicons name="open-outline" size={18} color="#26705d" />
              </TouchableOpacity>
            </View>
            <View style={styles.clipActionRow}>
              <PlayerControls
                onReplay={() => onReplaySelectedMatch(1)}
                onReplaySlow={() => onReplaySelectedMatch(0.75)}
                onPlayPause={onToggleMatchPlayback}
                isPlaying={playerIsPlaying}
                playDisabled={!selectedMatch}
                compact
                containerStyle={styles.clipPlayerControls}
              />
              <View style={styles.clipNavHeader}>
                <TouchableOpacity
                  style={[
                    styles.clipNavArrow,
                    !previousMatch && styles.clipNavArrowDisabled,
                  ]}
                  onPress={() => previousMatch && onPlayMatch(previousMatch)}
                  disabled={!previousMatch}
                >
                  <Ionicons name="arrow-back" size={18} color="#3d3a52" />
                </TouchableOpacity>
                <Text style={styles.clipNavCount}>
                  Clip {selectedMatchIndex + 1} of {matches.length}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.clipNavArrow,
                    !nextMatch && styles.clipNavArrowDisabled,
                  ]}
                  onPress={() => nextMatch && onPlayMatch(nextMatch)}
                  disabled={!nextMatch}
                >
                  <Ionicons name="arrow-forward" size={18} color="#3d3a52" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.segmentTranscript}>{segmentTranscript}</Text>
          </>
        ) : (
          <View style={styles.emptyVideoState}>
            <Ionicons name="film-outline" size={24} color="#5a5680" />
            <Text style={styles.emptyText}>
              {phraseError ||
                "Matched video clips will appear after you highlight text."}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  clipColumn: {
    flex: 1.2,
    gap: 16,
  },
  videoPane: {
    flex: 1,
    minHeight: 460,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  paneHeader: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  videoPaneHeader: {
    marginHorizontal: -14,
  },
  paneTitle: {
    color: "#2f3140",
    fontSize: 16,
    fontWeight: "900",
  },
  emptyText: {
    color: "#697187",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  playerShell: {
    height: 320,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  clipPlayerControls: {
    alignSelf: "flex-start",
  },
  matchTitleRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  matchTitleTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  matchTitle: {
    color: "#2f3140",
    fontSize: 14,
    fontWeight: "900",
  },
  matchChannel: {
    marginTop: 2,
    color: "#697187",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  openVideoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf4f2",
    borderWidth: 1,
    borderColor: "rgba(38, 112, 93, 0.18)",
  },
  clipActionRow: {
    minHeight: 42,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  segmentTranscript: {
    marginTop: 12,
    color: "#697187",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    minHeight: 86,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f7f9ff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.12)",
  },
  segmentTranscriptWordActive: {
    color: "#26705d",
    fontWeight: "900",
  },
  clipNavHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  clipNavArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.22)",
  },
  clipNavArrowDisabled: {
    opacity: 0.32,
  },
  clipNavCount: {
    minWidth: 88,
    color: "#3d3a52",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyVideoState: {
    flex: 1,
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
});

export default ClipMatcher;
