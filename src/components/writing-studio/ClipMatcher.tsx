import React, { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { TranscriptPhraseMatch } from "../../requests";
import type { Sentence } from "../../types";
import YouTubePlayer from "../common/YouTubePlayer";
import PlayerControls from "../shadow/PlayerControls";
import type { ClipMatcherController } from "./useClipMatcher";

interface ClipMatcherProps {
  clipMatcher: ClipMatcherController;
  channelTitleById: Map<string, string>;
  hideSegmentTranscript?: boolean;
  onOpenSelectedVideo: () => void;
}

const makeClipSentence = (match: TranscriptPhraseMatch): Sentence => ({
  index: match.segmentId,
  start: match.start,
  end: match.end,
  text: match.clipText,
  words: [],
});

const ClipMatcher: React.FC<ClipMatcherProps> = (props) => {
  const {
    clipMatcher: cm,
    channelTitleById,
    hideSegmentTranscript = false,
    onOpenSelectedVideo,
  } = props;

  const segmentTranscript = useMemo(() => {
    const match = cm.selectedMatch;
    if (!match) return null;

    const words = match.segmentWords.length
      ? match.segmentWords
      : match.segmentText.split(/\s+/).filter(Boolean);

    return words.map((word, index) => {
      const isHighlighted =
        match.highlightStartIndex !== null &&
        match.highlightEndIndex !== null &&
        index >= match.highlightStartIndex &&
        index <= match.highlightEndIndex;

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
  }, [cm.selectedMatch]);

  return (
    <View style={styles.clipColumn}>
      <View style={styles.videoPane}>
        <View style={[styles.paneHeader, styles.videoPaneHeader]}>
          <Text style={styles.paneTitle}>Clip Match</Text>
          {cm.isSearchingPhrase && (
            <ActivityIndicator size="small" color="#5a5680" />
          )}
        </View>

        {cm.selectedMatch ? (
          <>
            <View style={styles.playerShell}>
              <YouTubePlayer
                ref={cm.playerRef}
                videoId={cm.selectedMatch.videoId}
                clip={makeClipSentence(cm.selectedMatch)}
                autoplay
                refreshKey={cm.playerRefreshKey}
                setTime={cm.setPlayerTime}
                startTime={cm.playerTime}
                videoText={cm.selectedMatchPhrase}
                onPlayingStateChange={cm.setPlayerIsPlaying}
                onPress={cm.toggleMatchPlayback}
                webCropMode="narrow"
              />
            </View>
            <View style={styles.matchTitleRow}>
              <View style={styles.matchTitleTextGroup}>
                <Text style={styles.matchTitle} numberOfLines={1}>
                  {cm.selectedMatch.title}
                </Text>
                <Text style={styles.matchChannel} numberOfLines={1}>
                  {channelTitleById.get(cm.selectedMatch.channelId) ??
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
                onReplay={() => cm.replaySelectedMatch(1)}
                onReplaySlow={() => cm.replaySelectedMatch(0.75)}
                onPlayPause={cm.toggleMatchPlayback}
                isPlaying={cm.playerIsPlaying}
                playDisabled={!cm.selectedMatch}
                compact
                containerStyle={styles.clipPlayerControls}
              />
              <View style={styles.clipNavHeader}>
                <TouchableOpacity
                  style={[
                    styles.clipNavArrow,
                    !cm.previousMatch && styles.clipNavArrowDisabled,
                  ]}
                  onPress={() =>
                    cm.previousMatch && cm.playMatch(cm.previousMatch)
                  }
                  disabled={!cm.previousMatch}
                >
                  <Ionicons name="arrow-back" size={18} color="#3d3a52" />
                </TouchableOpacity>
                <Text style={styles.clipNavCount}>
                  Clip {cm.selectedMatchIndex + 1} of {cm.matches.length}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.clipNavArrow,
                    !cm.nextMatch && styles.clipNavArrowDisabled,
                  ]}
                  onPress={() => cm.nextMatch && cm.playMatch(cm.nextMatch)}
                  disabled={!cm.nextMatch}
                >
                  <Ionicons name="arrow-forward" size={18} color="#3d3a52" />
                </TouchableOpacity>
              </View>
            </View>
            {!hideSegmentTranscript && (
              <Text style={styles.segmentTranscript}>{segmentTranscript}</Text>
            )}
          </>
        ) : (
          <View style={styles.emptyVideoState}>
            <Ionicons name="film-outline" size={24} color="#5a5680" />
            <Text style={styles.emptyText}>
              {cm.phraseError ||
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
    flex: 1,
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
