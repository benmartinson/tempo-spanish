import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSelector } from "react-redux";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { RootState } from "../../types";
import FullSegmentTranscriptBubble from "../common/FullSegmentTranscriptBubble";
import { useRecording } from "../../hooks/useRecording";
import {
  sendAudioForTranscription,
  setAudioModeForRecording,
} from "../../helpers/streaming_helpers";
import { calculateAccuracy } from "../../helpers/calculate_accuracy";
import { AccuracyResult } from "../../types";
import ShadowResults from "../shadow/ShadowResults";

interface SegmentResult {
  segmentIndex: number;
  segmentText: string;
  percentage: number;
  status: "processing" | "complete" | "error";
  accuracyResult?: AccuracyResult;
}

interface TurnTakingTabProps {
  time: number;
  playKey?: number;
  playerSpeed?: number;
  handleNextSentence: () => void;
  handlePreviousSentence: () => void;
  isActive?: boolean;
  playSentence: () => void;
  setPlayerSpeed: (speed: number) => void;
  pausePlayer: () => void;
  resumePlayer: () => void;
  playerIsPlaying: boolean;
  mutePlayer: () => void;
  unMutePlayer: () => void;
  orderedCharacters: string[];
  targetLanguage: string;
}

const getScoreColor = (percentage: number) => {
  if (percentage >= 75) return "#22c55e";
  if (percentage >= 40) return "#eab308";
  return "#ef4444";
};

const TurnTakingTab: React.FC<TurnTakingTabProps> = ({
  time,
  playKey,
  playerSpeed,
  isActive = true,
  playSentence,
  setPlayerSpeed,
  pausePlayer,
  resumePlayer,
  playerIsPlaying,
  mutePlayer,
  unMutePlayer,
  orderedCharacters,
  targetLanguage,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const currentSentenceIndex = currentVideo?.currentSentence ?? 0;
  const currentSentence = currentVideo
    ? currentVideo.sentences[currentSentenceIndex]
    : null;

  const [started, setStarted] = useState(false);
  const startIndexRef = useRef(0);
  // Cycle: 2 listen segments, then 1 user segment (period of 3)
  const isUserTurn =
    started && (currentSentenceIndex - startIndexRef.current) % 3 === 2;

  // Countdown: show during the last listen segment before a user turn
  const isPreUserTurn =
    started && (currentSentenceIndex - startIndexRef.current) % 3 === 1;
  const timeUntilEnd = currentSentence ? currentSentence.end - time : Infinity;
  const countdown =
    isPreUserTurn && timeUntilEnd <= 3 && timeUntilEnd > 0
      ? Math.ceil(timeUntilEnd)
      : null;

  const wasActiveRef = useRef(isActive);
  const prevSentenceIndexRef = useRef(currentSentenceIndex);
  const [selectedResult, setSelectedResult] = useState<SegmentResult | null>(
    null,
  );
  const [results, setResults] = useState<SegmentResult[]>([]);

  // Per-turn recording
  const handleRecordingComplete = useCallback(() => {}, []);
  const { isRecording, startRecording, stopRecording } =
    useRecording({
      onRecordingComplete: handleRecordingComplete,
      skipAudioModeChange: true,
    });

  // Process a completed user-turn recording
  const processSegment = useCallback(
    async (
      audioUri: string,
      segmentIndex: number,
      segmentText: string,
    ) => {
      setResults((prev) => [
        ...prev,
        {
          segmentIndex,
          segmentText,
          percentage: 0,
          status: "processing",
        },
      ]);

      try {
        const transcription = await sendAudioForTranscription(
          audioUri,
          targetLanguage,
        );

        const spokenWords = transcription.transcript
          .split(/\s+/)
          .filter(Boolean);
        const targetWords = segmentText.split(/\s+/).filter(Boolean);

        const accuracy = calculateAccuracy(
          spokenWords,
          targetWords,
          orderedCharacters,
        );

        setResults((prev) =>
          prev.map((r) =>
            r.segmentIndex === segmentIndex
              ? {
                  ...r,
                  percentage: accuracy.percentage,
                  status: "complete",
                  accuracyResult: accuracy,
                }
              : r,
          ),
        );
      } catch (err) {
        console.error(`Turn-taking segment ${segmentIndex} error:`, err);
        setResults((prev) =>
          prev.map((r) =>
            r.segmentIndex === segmentIndex ? { ...r, status: "error" } : r,
          ),
        );
      }
    },
    [targetLanguage, orderedCharacters],
  );

  const handleStart = () => {
    startIndexRef.current = currentSentenceIndex;
    prevSentenceIndexRef.current = currentSentenceIndex;
    setResults([]);
    setStarted(true);
    unMutePlayer();
    setPlayerSpeed(1);
    playSentence();
  };

  // When sentence changes:
  // Entering user turn: pause → enable recording → mute → 0.4x → play
  // Leaving user turn:  pause → stop recording → disable recording → unmute → 1x → play
  useEffect(() => {
    if (!isActive || !started) return;
    if (prevSentenceIndexRef.current === currentSentenceIndex) return;

    const prevIndex = prevSentenceIndexRef.current;
    const wasPrevUserTurn =
      (prevIndex - startIndexRef.current) % 3 === 2;
    prevSentenceIndexRef.current = currentSentenceIndex;

    // Only pause for audio session changes (entering or leaving user turn)
    if (wasPrevUserTurn || isUserTurn) {
      const transition = async () => {
        pausePlayer();

        if (wasPrevUserTurn) {
          // Leaving user turn — stop recording, disable recording mode
          const prevSentence = currentVideo?.sentences[prevIndex];
          const audioUri = await stopRecording();
          await setAudioModeForRecording(false);
          if (audioUri && prevSentence) {
            processSegment(audioUri, prevSentence.index, prevSentence.text);
          }
        }

        if (isUserTurn) {
          // Entering user turn — enable recording mode, start recording
          mutePlayer();
          setPlayerSpeed(0.4);
          await setAudioModeForRecording(true);
          await startRecording();
        } else {
          unMutePlayer();
          setPlayerSpeed(1);
        }

        resumePlayer();
      };

      transition();
    }
  }, [currentSentenceIndex, isActive, started]);

  // When tab becomes active, reset to start screen; when leaving, clean up
  useEffect(() => {
    const cleanup = async () => {
      if (isRecording) {
        await stopRecording();
      }
      await setAudioModeForRecording(false);
      unMutePlayer();
      setPlayerSpeed(1);
    };

    if (isActive && !wasActiveRef.current) {
      setStarted(false);
      setResults([]);
      setSelectedResult(null);
      cleanup();
    } else if (!isActive && wasActiveRef.current) {
      cleanup();
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  if (!currentVideo) return null;

  // Start screen
  if (!started) {
    return (
      <View style={styles.startContainer}>
        <MaterialIcons name="swap-horiz" size={48} color="#3d3a52" />
        <Text style={styles.startTitle}>Turn Taking</Text>
        <Text style={styles.startDescription}>
          Take turns with the video — listen to one segment, then speak the
          next. Your speech will be recorded and scored.
        </Text>
        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <MaterialIcons name="play-arrow" size={24} color="white" />
          <Text style={styles.startButtonText}>Start Turns</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (selectedResult?.accuracyResult) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.resultsScroll}>
          <ShadowResults
            accuracyResult={selectedResult.accuracyResult}
            handleNextSentence={() => {}}
            handleRetry={() => setSelectedResult(null)}
            properNouns={orderedCharacters}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.turnIndicator}>
        <MaterialIcons
          name={isUserTurn ? "mic" : "volume-up"}
          size={20}
          color={isUserTurn ? "#e67e22" : "#4CAF50"}
        />
        <Text
          style={[
            styles.turnText,
            { color: isUserTurn ? "#e67e22" : "#4CAF50" },
          ]}
        >
          {countdown !== null
            ? `Starting turn in ${countdown}...`
            : isUserTurn
              ? "Your Turn — Speak!"
              : "Listen"}
        </Text>
        {isUserTurn && <Text style={styles.speedBadge}>0.4x</Text>}
        {isRecording && <View style={styles.recordingDot} />}
      </View>

      <FullSegmentTranscriptBubble
        words={currentSentence?.words ?? []}
        time={time}
        mode="video"
        playerIsPlaying={playerIsPlaying}
        playKey={playKey}
        playerSpeed={playerSpeed}
      />

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.stopButton}
          onPress={async () => {
            if (isRecording) {
              await stopRecording();
            }
            await setAudioModeForRecording(false);
            pausePlayer();
            unMutePlayer();
            setPlayerSpeed(1);
            setStarted(false);
          }}
        >
          <MaterialIcons name="stop" size={22} color="white" />
          <Text style={styles.stopButtonText}>Stop</Text>
        </TouchableOpacity>
      </View>

      {results.length > 0 && (
        <ScrollView style={styles.resultsList}>
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
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  startContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  startTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3d3a52",
  },
  startDescription: {
    fontSize: 15,
    color: "#888",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#3d3a52",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
  },
  startButtonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  turnIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#fafafa",
    borderRadius: 12,
  },
  turnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  speedBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e67e22",
    backgroundColor: "#fef3e2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  resultsList: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    marginBottom: 8,
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
    width: 48,
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
  resultsScroll: {
    flex: 1,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ef4444",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  stopButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default TurnTakingTab;
