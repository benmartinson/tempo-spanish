import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { RootState, SegmentWord, Sentence } from "../../types";
import { useSelector } from "react-redux";
import FullSegmentTranscriptBubble from "../common/FullSegmentTranscriptBubble";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import NavSwitcher from "../common/NavSwitcher";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import PlayerControls from "../shadow/PlayerControls";
import { useRecording } from "../useRecording";
import { useSpeedRunSession, SegmentResult } from "./useSpeedRunSession";
import ShadowResults from "../shadow/ShadowResults";

interface SpeedRunTabProps {
  time: number;
  currentSentence: Sentence;
  setCurrentSentence: React.Dispatch<React.SetStateAction<number>>;
  setAutoplay: (autoplay: boolean) => void;
  refreshPlayer: () => void;
  isActive?: boolean;
  hintWords: SegmentWord[];
  handlePlayWordSnippet: (word: SegmentWord) => void;
  isPlayingWordSnippet: boolean;
  pausePlayer: () => void;
  resumePlayer: () => void;
  playerIsPlaying: boolean;
  setPlayerSpeed: (speed: number) => void;
  handleNextSentence: () => void;
  handlePreviousSentence: () => void;
  onPlayClip: (time: number) => void;
  playSentence: () => void;
  orderedCharacters: string[];
  targetLanguage: string;
  mutePlayer: () => void;
  unMutePlayer: () => void;
  onTimeUpdate: (time: number) => void;
}

const getScoreColor = (percentage: number) => {
  if (percentage >= 75) return "#22c55e";
  if (percentage >= 40) return "#eab308";
  return "#ef4444";
};

const SpeedRunTab: React.FC<SpeedRunTabProps> = ({
  time,
  currentSentence,
  handleNextSentence,
  handlePreviousSentence,
  onPlayClip,
  playSentence,
  pausePlayer,
  resumePlayer,
  playerIsPlaying,
  setPlayerSpeed,
  orderedCharacters,
  targetLanguage,
  mutePlayer,
  unMutePlayer,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const prevSentenceRef = useRef<Sentence | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.5);
  const [selectedResult, setSelectedResult] = useState<SegmentResult | null>(
    null,
  );

  const handleRecordingComplete = useCallback(() => {}, []);

  const { isRecording, startRecording, stopRecording, getRecorderUri } =
    useRecording({
      onRecordingComplete: handleRecordingComplete,
    });

  const { results, startSession, onSegmentComplete, endSession } =
    useSpeedRunSession({
      targetLanguage,
      properNouns: orderedCharacters,
    });

  // Detect segment boundary while recording
  useEffect(() => {
    if (
      isRecording &&
      prevSentenceRef.current &&
      prevSentenceRef.current.index !== currentSentence.index
    ) {
      const uri = getRecorderUri();
      if (uri) {
        onSegmentComplete(prevSentenceRef.current, uri);
      }
    }
    prevSentenceRef.current = currentSentence;
  }, [currentSentence.index, isRecording]);

  const handleReplay = useCallback(() => {
    unMutePlayer();
    setPlayerSpeed(1);
    playSentence();
  }, [playSentence, setPlayerSpeed, unMutePlayer]);

  const handleReplaySlow = useCallback(() => {
    unMutePlayer();
    setPlayerSpeed(0.8);
    playSentence();
  }, [playSentence, setPlayerSpeed, unMutePlayer]);

  const handlePlayPause = useCallback(() => {
    if (playerIsPlaying) {
      pausePlayer();
    } else {
      unMutePlayer();
      setPlayerSpeed(1);
      resumePlayer();
    }
  }, [
    playerIsPlaying,
    pausePlayer,
    resumePlayer,
    unMutePlayer,
    setPlayerSpeed,
  ]);

  const handleRecord = useCallback(async () => {
    mutePlayer();
    setPlayerSpeed(playbackSpeed);
    startSession();
    await startRecording();
    prevSentenceRef.current = currentSentence;
    playSentence();
  }, [
    startRecording,
    startSession,
    currentSentence,
    mutePlayer,
    setPlayerSpeed,
    playbackSpeed,
    playSentence,
  ]);

  const handleStop = useCallback(async () => {
    const uri = getRecorderUri();
    if (uri) {
      endSession(currentSentence, uri);
    }
    await stopRecording();
    pausePlayer();
  }, [stopRecording, pausePlayer, endSession, currentSentence, getRecorderUri]);

  const currentSentenceIndex = currentVideo ? currentVideo.currentSentence : 0;

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

  return (
    <View style={styles.container}>
      <NavSwitcher
        onPrev={handlePreviousSentence}
        onNext={handleNextSentence}
        currentIndex={currentSentenceIndex}
        totalItems={currentVideo.sentences.length}
        sentences={currentVideo.sentences}
        onPlayClip={onPlayClip}
        videoId={currentVideo.videoId}
      >
        <Text style={styles.segmentNavText}>
          Segment {currentSentenceIndex + 1} of{" "}
          {currentVideo.sentences.length + 1}
        </Text>
      </NavSwitcher>
      {selectedResult?.accuracyResult ? (
        <ScrollView style={styles.transcriptContainer}>
          <ShadowResults
            accuracyResult={selectedResult.accuracyResult}
            handleNextSentence={() => {}}
            handleRetry={() => setSelectedResult(null)}
            properNouns={orderedCharacters}
          />
        </ScrollView>
      ) : (
        <>
          <View style={styles.controlsContainer}>
            <PlayerControls
              onReplay={handleReplay}
              onReplaySlow={handleReplaySlow}
              onPlayPause={handlePlayPause}
              isPlaying={playerIsPlaying}
            />
          </View>
          <ScrollView style={styles.transcriptContainer}>
            <FullSegmentTranscriptBubble
              words={currentSentence.words || []}
              time={time}
              playerIsPlaying={playerIsPlaying}
              showFullText
            />

            {results.length > 0 && (
              <View style={styles.resultsList}>
                {[...results].reverse().map((result) => (
                  <TouchableOpacity
                    key={result.segmentIndex}
                    style={styles.resultRow}
                    onPress={() =>
                      result.status === "complete"
                        ? setSelectedResult(result)
                        : null
                    }
                    disabled={result.status !== "complete"}
                  >
                    <Text style={styles.resultSegmentLabel}>
                      Seg {result.segmentIndex + 1}
                    </Text>
                    {result.status === "processing" ? (
                      <ActivityIndicator size="small" color="#888" />
                    ) : result.status === "error" ? (
                      <Text style={styles.resultError}>Error</Text>
                    ) : (
                      <Text
                        style={[
                          styles.resultPercentage,
                          { color: getScoreColor(result.percentage) },
                        ]}
                      >
                        {result.percentage}%
                      </Text>
                    )}
                    <Text style={styles.resultText} numberOfLines={1}>
                      {result.segmentText}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.recordButtonContainer}>
            {isRecording ? (
              <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
                <MaterialIcons name="stop" size={24} color="#ff6b6b" />
                <Text style={styles.stopButtonText}>Stop</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.recordButton}
                onPress={handleRecord}
              >
                <MaterialIcons name="mic" size={24} color="black" />
                <Text style={styles.recordButtonText}>Record</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    paddingBottom: 24,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 16,
  },
  segmentNavText: {
    opacity: 0.6,
  },
  transcriptContainer: {
    flex: 1,
  },
  resultsList: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
  },
  resultSegmentLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    width: 44,
  },
  resultPercentage: {
    fontSize: 16,
    fontWeight: "700",
    width: 44,
  },
  resultError: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
    width: 44,
  },
  resultText: {
    flex: 1,
    fontSize: 13,
    color: "#888",
  },
  recordButtonContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#3d3a52",
    borderRadius: 24,
    gap: 8,
  },
  recordButtonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "600",
  },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ff6b6b",
    borderRadius: 24,
    gap: 8,
  },
  stopButtonText: {
    color: "#ff6b6b",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SpeedRunTab;
