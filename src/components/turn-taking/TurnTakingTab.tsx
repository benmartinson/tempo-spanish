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
import { AccuracyResult, SegmentWord } from "../../types";
import ShadowResults from "../shadow/ShadowResults";
import AccuracyCircle from "../common/AccuracyCircle";
import FeaturedVocab from "../speed-run/FeaturedVocab";
import { vocabFormatWord } from "../../helpers/helpers";

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
  advanceSentence: () => void;
  orderedCharacters: string[];
  targetLanguage: string;
}

const getScoreColor = (percentage: number) => {
  if (percentage >= 75) return "#22c55e";
  if (percentage >= 40) return "#eab308";
  return "#ef4444";
};

interface StoppedResultsTabsProps {
  missedWords: SegmentWord[];
  results: SegmentResult[];
  onSelectResult: (result: SegmentResult) => void;
}

const StoppedResultsTabs: React.FC<StoppedResultsTabsProps> = ({
  missedWords,
  results,
  onSelectResult,
}) => {
  const [activeTab, setActiveTab] = useState<"missed" | "individual">("missed");
  const [missedWordIndex, setMissedWordIndex] = useState(0);
  const currentMissedWord = missedWords[missedWordIndex];

  const handleWordChange = (direction: number) => {
    if (missedWords.length === 0) return;
    let newIndex = missedWordIndex + direction;
    if (newIndex < 0) newIndex = missedWords.length - 1;
    if (newIndex >= missedWords.length) newIndex = 0;
    setMissedWordIndex(newIndex);
  };

  return (
    <View>
      <View style={styles.stoppedTabs}>
        <TouchableOpacity
          style={[
            styles.stoppedTab,
            activeTab === "missed" && styles.stoppedTabActive,
          ]}
          onPress={() => setActiveTab("missed")}
        >
          <Text
            style={[
              styles.stoppedTabText,
              activeTab === "missed" && styles.stoppedTabTextActive,
            ]}
          >
            Missed Words
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.stoppedTab,
            activeTab === "individual" && styles.stoppedTabActive,
          ]}
          onPress={() => setActiveTab("individual")}
        >
          <Text
            style={[
              styles.stoppedTabText,
              activeTab === "individual" && styles.stoppedTabTextActive,
            ]}
          >
            Individual Results
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "missed" ? (
        missedWords.length > 0 ? (
          <View>
            <View style={styles.missedWordNav}>
              <TouchableOpacity
                onPress={() => handleWordChange(-1)}
                style={styles.missedWordNavButton}
              >
                <MaterialIcons name="arrow-back" size={24} color="#5a5680" />
              </TouchableOpacity>
              <Text style={styles.missedWordCount}>
                {missedWordIndex + 1} / {missedWords.length}
              </Text>
              <TouchableOpacity
                onPress={() => handleWordChange(1)}
                style={styles.missedWordNavButton}
              >
                <MaterialIcons name="arrow-forward" size={24} color="#5a5680" />
              </TouchableOpacity>
            </View>
            <FeaturedVocab
              word={currentMissedWord}
              playSnippet={() => {}}
              isPlayingWordSnippet={false}
              handleWordHintChange={handleWordChange}
              showSlowPlay={false}
            />
          </View>
        ) : (
          <View style={styles.noMissedWords}>
            <Text style={styles.noMissedWordsText}>No missed words!</Text>
          </View>
        )
      ) : (
        <View style={{ marginHorizontal: 16 }}>
          {[...results].reverse().map((result) => (
            <TouchableOpacity
              key={result.segmentIndex}
              style={styles.resultRow}
              onPress={() => onSelectResult(result)}
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
    </View>
  );
};

const TurnTakingTab: React.FC<TurnTakingTabProps> = ({
  time,
  playKey,
  playerSpeed,
  isActive = true,
  handleNextSentence,
  playSentence,
  setPlayerSpeed,
  pausePlayer,
  resumePlayer,
  playerIsPlaying,
  mutePlayer,
  unMutePlayer,
  advanceSentence,
  orderedCharacters,
  targetLanguage,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const allVocabulary = useSelector((state: RootState) => state.allVocabulary);
  const currentSentenceIndex = currentVideo?.currentSentence ?? 0;
  const currentSentence = currentVideo
    ? currentVideo.sentences[currentSentenceIndex]
    : null;

  const [started, setStarted] = useState(false);
  const [stopped, setStopped] = useState(false);
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

  const handleStart = (keepResults = false) => {
    if (!keepResults) {
      startIndexRef.current = currentSentenceIndex;
      setResults([]);
    } else {
      startIndexRef.current = currentSentenceIndex;
    }
    prevSentenceIndexRef.current = currentSentenceIndex;
    setStopped(false);
    setStarted(true);
    unMutePlayer();
    setPlayerSpeed(1);
    playSentence();
  };

  const handleStop = async () => {
    if (isRecording) {
      await stopRecording(true); // trash the recording
    }
    await setAudioModeForRecording(false);
    pausePlayer();
    unMutePlayer();
    setPlayerSpeed(1);
    setStarted(false);
    setStopped(true);
  };

  const handleRetry = () => {
    handleStart(false);
  };

  const handleKeepGoing = () => {
    handleStart(true);
  };

  // All segment transitions managed here via video time
  // SelectedVideoTabs handleSetTime does NOT advance for turn-taking
  const transitioningRef = useRef(false);

  useEffect(() => {
    if (!isActive || !started || !currentSentence) return;
    if (transitioningRef.current) return;

    const timeRemaining = currentSentence.end - time;
    if (timeRemaining > 0.3 || timeRemaining < -0.5) return;

    const offset = (currentSentenceIndex - startIndexRef.current) % 3;

    if (offset === 0) {
      // Listen-to-listen (offset 0→1): just advance index, video keeps playing
      advanceSentence();
      return;
    }

    // Turn boundary — pause first, do all setup, THEN advance to next segment
    transitioningRef.current = true;

    const transition = async () => {
      pausePlayer();

      if (offset === 2) {
        // Ending user turn — tear down recording while still on this segment
        const audioUri = await stopRecording();
        await setAudioModeForRecording(false);
        if (audioUri && currentSentence) {
          processSegment(audioUri, currentSentence.index, currentSentence.text);
        }
        unMutePlayer();
        setPlayerSpeed(1);
      }

      if (offset === 1) {
        // About to enter user turn — set up recording while still on this segment
        await setAudioModeForRecording(true);
        await startRecording();
        mutePlayer();
        setPlayerSpeed(0.25);
      }

      // Now advance and resume
      handleNextSentence();
      transitioningRef.current = false;
    };

    transition();
  }, [time, isActive, started]);

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
      setStopped(false);
      setResults([]);
      setSelectedResult(null);
      cleanup();
    } else if (!isActive && wasActiveRef.current) {
      cleanup();
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  if (!currentVideo) return null;

  // Stopped screen — show results summary with retry/keep going
  if (!started && stopped && results.length > 0) {
    const completedResults = results.filter((r) => r.status === "complete");
    const totalPercentage =
      completedResults.length > 0
        ? Math.round(
            completedResults.reduce((sum, r) => sum + r.percentage, 0) /
              completedResults.length,
          )
        : 0;

    // Collect missed words across all completed results
    const missedWords: SegmentWord[] = [];
    const seenWords = new Set<string>();
    for (const result of completedResults) {
      if (!result.accuracyResult) continue;
      const sentence = currentVideo.sentences[result.segmentIndex];
      if (!sentence) continue;
      for (const detail of result.accuracyResult.details) {
        if (detail.matched || detail.isProperNoun) continue;
        const key = vocabFormatWord(detail.targetWord);
        if (seenWords.has(key)) continue;
        seenWords.add(key);
        const segWord = sentence.words.find(
          (w) => vocabFormatWord(w.word) === key,
        );
        if (segWord && allVocabulary[key]) {
          missedWords.push(segWord);
        }
      }
    }
    // Sort by frequency (lower frequency = rarer = more important to review)
    missedWords.sort((a, b) => a.frequency - b.frequency);

    return (
      <View style={styles.container}>
        <ScrollView style={styles.resultsScroll} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={styles.summaryContainer}>
            <AccuracyCircle percentage={totalPercentage} />
          </View>

          <View style={styles.stoppedButtons}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <MaterialIcons name="replay" size={20} color="white" />
              <Text style={styles.retryButtonText}>Re-Try</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.keepGoingButton}
              onPress={handleKeepGoing}
            >
              <MaterialIcons name="play-arrow" size={20} color="white" />
              <Text style={styles.keepGoingButtonText}>Keep Going</Text>
            </TouchableOpacity>
          </View>

          <StoppedResultsTabs
            missedWords={missedWords}
            results={results}
            onSelectResult={(result) =>
              result.status === "complete" ? setSelectedResult(result) : null
            }
          />
        </ScrollView>
      </View>
    );
  }

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
        <TouchableOpacity style={styles.startButton} onPress={() => handleStart()}>
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
        {isUserTurn && <Text style={styles.speedBadge}>0.25x</Text>}
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
        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
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
  summaryContainer: {
    alignItems: "center" as const,
    paddingVertical: 16,
  },
  stoppedButtons: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    gap: 16,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  retryButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    backgroundColor: "#3d3a52",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600" as const,
  },
  keepGoingButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    backgroundColor: "#22c55e",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  keepGoingButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600" as const,
  },
  stoppedTabs: {
    flexDirection: "row" as const,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#f0f0f5",
    overflow: "hidden" as const,
  },
  stoppedTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center" as const,
  },
  stoppedTabActive: {
    backgroundColor: "#3d3a52",
    borderRadius: 8,
  },
  stoppedTabText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#666",
  },
  stoppedTabTextActive: {
    color: "white",
  },
  missedWordNav: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 16,
    marginBottom: 4,
  },
  missedWordNavButton: {
    padding: 8,
    borderRadius: 24,
  },
  missedWordCount: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#666",
  },
  noMissedWords: {
    alignItems: "center" as const,
    paddingVertical: 24,
  },
  noMissedWordsText: {
    fontSize: 15,
    color: "#888",
  },
});

export default TurnTakingTab;
