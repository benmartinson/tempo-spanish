import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { RootState, Segment, SegmentWord } from "../../types";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import FullSegmentTranscriptBubble from "../watch/FullSegmentTranscriptBubble";
import { useRecording } from "../useRecording";
import {
  sendAudioForTranscription,
  calculateAccuracy,
  AccuracyResult,
} from "../streaming_helpers";
import SettingsModal from "./SettingsModal";
import CountdownTimer from "./CountdownTimer";
import {
  findNextSegmentWithVocab,
  findSentenceWithVocab,
  findTimesForVocab,
  normalizeWord,
  splitIntoSentences,
} from "../../helpers";
import ShadowResults from "./ShadowResults";
import VocabList from "../watch/VocabList";
import TooltipModal from "../common/TooltipModal";
import NavSwitcher from "../common/NavSwitcher";

interface ShadowTabProps {
  time: number;
  setTime: React.Dispatch<React.SetStateAction<number>>;
  currentSentence: number;
  setCurrentSentence: React.Dispatch<React.SetStateAction<number>>;
  clip: Segment | undefined;
  sentences: SegmentWord[][];
  currentSentenceWords: SegmentWord[];
  sentenceStart: number;
  sentenceEnd: number;
  sentencesText: string[];
  isLastSentence: boolean;
  isFirstSentence: boolean;
  isFirstSegment: boolean;
  handleNextSentence: () => void;
  handlePreviousSentence: () => void;
  handleNextSegment: () => void;
  handlePreviousSegment: () => void;
  setPlayerMuted: (muted: boolean) => void;
  setPlayerSpeed: (speed: number) => void;
  refreshPlayer: () => void;
  seekToTime: (targetTime: number, targetSentenceIndex?: number) => void;
  isActive?: boolean;
}

const ShadowTab: React.FC<ShadowTabProps> = ({
  time,
  setTime,
  currentSentence,
  setCurrentSentence,
  clip,
  sentences,
  currentSentenceWords,
  sentenceStart,
  sentenceEnd,
  sentencesText,
  isLastSentence,
  isFirstSentence,
  isFirstSegment,
  handleNextSentence: parentHandleNextSentence,
  handlePreviousSentence: parentHandlePreviousSentence,
  handleNextSegment,
  handlePreviousSegment,
  setPlayerMuted,
  setPlayerSpeed,
  refreshPlayer,
  seekToTime,
  isActive = true,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const recordingExtensionRef = useRef<NodeJS.Timeout | null>(null);
  const focusVocab = currentVideo?.focusVocab || [];

  // Speed control state (internal settings)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [recordSpeed, setRecordSpeed] = useState<number>(0.75);
  const [muteVideoWhenRecording, setMuteVideoWhenRecording] =
    useState<boolean>(true);

  // Recording and transcription state
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [accuracyResult, setAccuracyResult] = useState<AccuracyResult | null>(
    null,
  );
  const [isSettingsVisible, setIsSettingsVisible] = useState<boolean>(false);
  const [isRecordingMode, setIsRecordingMode] = useState<boolean>(false);
  const [sentenceEnded, setSentenceEnded] = useState<boolean>(false);
  const [showNoVocabFoundTooltip, setShowNoVocabFoundTooltip] =
    useState<boolean>(false);
  const shouldAutoStopRef = useRef<boolean>(false);

  // Handle recording completion - send audio for transcription
  const handleRecordingComplete = useCallback(
    async (audioUri: string) => {
      setIsProcessing(true);
      setError(null);

      try {
        const result = await sendAudioForTranscription(audioUri);
        const spokenWords = result.transcript.split(/\s+/).filter(Boolean);
        const targetWords = currentSentenceWords.map((w) => w.word);
        const ignoredWords = currentSentenceWords
          .filter((w) => {
            const word = normalizeWord(w.word);
            return word.length <= 2 || normalizeWord(w.translation) === word;
          })
          .map((w) => w.word);

        const accuracy = calculateAccuracy(
          spokenWords,
          targetWords,
          ignoredWords,
        );
        setAccuracyResult(accuracy);
      } catch (err) {
        console.error("Transcription error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to process audio",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [currentSentenceWords],
  );

  const { isRecording, hasPermission, startRecording, stopRecording } =
    useRecording({
      onRecordingComplete: handleRecordingComplete,
      onError: (message) => setError(message),
    });

  // Handle changes in active state (tab switching)
  useEffect(() => {
    if (!isActive) {
      if (isRecording) {
        stopRecording();
      }
      setIsRecordingMode(false);
      setSentenceEnded(false);
      clearRecordingTimer();
      setIsSettingsVisible(false);
      setShowNoVocabFoundTooltip(false);
      shouldAutoStopRef.current = false;
    }
  }, [isActive, isRecording]);

  // Reset shadow-specific state when segment changes
  useEffect(() => {
    setError(null);
    setAccuracyResult(null);
    setIsProcessing(false);
    setPlayerMuted(false);
    setIsRecordingMode(false);
    shouldAutoStopRef.current = false;
    setSentenceEnded(false);
    if (recordingExtensionRef.current) {
      clearTimeout(recordingExtensionRef.current);
      recordingExtensionRef.current = null;
    }
  }, [currentVideo?.currentSegment]);

  // Detect when sentence ends (for CountdownTimer to show buffer)
  useEffect(() => {
    if (
      isRecording &&
      time >= sentenceEnd &&
      !sentenceEnded &&
      shouldAutoStopRef.current
    ) {
      setSentenceEnded(true);
    }
  }, [time, sentenceEnd, isRecording, sentenceEnded]);

  // Cleanup timer on unmount or sentence change
  useEffect(() => {
    return () => {
      if (recordingExtensionRef.current) {
        clearTimeout(recordingExtensionRef.current);
      }
    };
  }, [currentSentence]);

  const clearRecordingTimer = () => {
    if (recordingExtensionRef.current) {
      clearTimeout(recordingExtensionRef.current);
      recordingExtensionRef.current = null;
    }
  };

  // Helper to refresh player with specific speed and mute settings
  const refreshVideoPlayerAndState = (speed: number, muted: boolean) => {
    setPlayerSpeed(speed);
    setPlayerMuted(muted);
    refreshPlayer();
  };

  // Enter recording mode (shows countdown, then starts recording)
  const handleEnterRecordingMode = () => {
    setAccuracyResult(null);
    setError(null);
    setTime(sentenceStart);
    setSentenceEnded(false);
    setIsRecordingMode(true);
    clearRecordingTimer();
  };

  // Called by CountdownTimer after 3-second countdown
  const handleActualStartRecording = async () => {
    shouldAutoStopRef.current = true;
    await startRecording();
    refreshVideoPlayerAndState(recordSpeed, muteVideoWhenRecording);
  };

  // Called by CountdownTimer after buffer countdown completes
  const handleStopRecording = async () => {
    shouldAutoStopRef.current = false;
    setIsRecordingMode(false);
    await stopRecording();
  };

  // Shadow-specific sentence navigation (wraps parent with recording state cleanup)
  const handleShadowPreviousSentence = () => {
    if (isFirstSentence) {
      if (!isFirstSegment) {
        setCurrentSentence(sentences.length - 1);
        handlePreviousSegment();
      }
    } else {
      setCurrentSentence((prev) => prev - 1);
      setAccuracyResult(null);
      setSentenceEnded(false);
      clearRecordingTimer();
      refreshVideoPlayerAndState(playbackSpeed, false);
    }
  };

  const handleShadowNextSentence = () => {
    if (isLastSentence) {
      handleNextSegment();
    } else {
      setCurrentSentence((prev) => prev + 1);
      setAccuracyResult(null);
      setSentenceEnded(false);
      clearRecordingTimer();
      refreshVideoPlayerAndState(playbackSpeed, false);
    }
  };

  const handlePlaySnippetAgain = () => {
    setIsRecordingMode(false);
    setTime(sentenceStart);
    setAccuracyResult(null);
    setSentenceEnded(false);
    clearRecordingTimer();
    refreshVideoPlayerAndState(playbackSpeed, false);
  };

  const handleSettingsToggle = () => {
    setIsSettingsVisible(!isSettingsVisible);
  };

  const handleSkipToVocab = (word: SegmentWord) => {
    const [nextSegment, nextFocusVocabTime] = findNextSegmentWithVocab(
      focusVocab,
      word,
      currentVideo!.segments,
      currentVideo!.currentSegment,
    );
    if (nextSegment && nextFocusVocabTime) {
      const sentence = findSentenceWithVocab(
        nextSegment,
        nextFocusVocabTime.start,
      );
      if (sentence && sentence >= 0) {
        setAccuracyResult(null);
        setSentenceEnded(false);
        clearRecordingTimer();
        const sentencesInSegment = splitIntoSentences(nextSegment.words);
        seekToTime(sentencesInSegment[sentence][0].start, sentence);
        return;
      }
    }
    setShowNoVocabFoundTooltip(true);
  };

  const currentSentenceIndex =
    currentVideo?.currentSegment * 3 + currentSentence;

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

  return (
    <>
      <View style={styles.container}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <ScrollView style={styles.transcriptContainer}>
          {/* Recording button or processing indicator */}
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#4ade80" />
              <Text style={styles.processingText}>
                Analyzing your pronunciation...
              </Text>
            </View>
          ) : accuracyResult ? (
            <ShadowResults
              accuracyResult={accuracyResult}
              handleEnterRecordingMode={handleEnterRecordingMode}
              handleNextSentence={handleShadowNextSentence}
              handlePlaySnippetAgain={handlePlaySnippetAgain}
            />
          ) : isRecordingMode ? (
            <>
              <CountdownTimer
                onStartRecording={handleActualStartRecording}
                onStopRecording={handleStopRecording}
                sentenceEnded={sentenceEnded}
                bufferDuration={5}
                countdownDuration={3}
              />
              <FullSegmentTranscriptBubble
                words={currentSentenceWords}
                time={time}
                showFullText={true}
                mode="video"
              />
            </>
          ) : (
            <>
              {/* Sentence Navigation */}
              <NavSwitcher
                onPrev={handleShadowPreviousSentence}
                onNext={handleShadowNextSentence}
                currentIndex={currentSentence}
                totalItems={currentVideo.segments.length * 3}
              >
                <Text>
                  Sentence {currentSentenceIndex + 1} of{" "}
                  {currentVideo.segments.length * 3}
                </Text>
              </NavSwitcher>
              <FullSegmentTranscriptBubble
                words={currentSentenceWords}
                time={time}
                mode="video"
              />
              <View style={styles.recordButtonContainer}>
                <TouchableOpacity
                  style={styles.playSegmentButton}
                  onPress={handlePlaySnippetAgain}
                >
                  <Text style={styles.playSegmentButtonText}>
                    Play Sentence
                  </Text>
                  <MaterialIcons name="play-arrow" size={20} color="black" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.recordButton}
                  onPress={handleEnterRecordingMode}
                  disabled={!hasPermission || isProcessing}
                >
                  <MaterialIcons name="mic" size={20} color="red" />
                  <Text style={styles.recordButtonText}>Record Yourself</Text>
                </TouchableOpacity>
              </View>
              {/* <VocabList
                vocab={focusVocabTimes}
                time={time}
                onSkipToVocab={handleSkipToVocab}
                header="Skip to selected vocab"
              /> */}
            </>
          )}
        </ScrollView>
      </View>
      {isSettingsVisible && (
        <SettingsModal
          visible={isSettingsVisible}
          onClose={() => setIsSettingsVisible(false)}
          playbackSpeed={playbackSpeed}
          recordSpeed={recordSpeed}
          setPlaybackSpeed={setPlaybackSpeed}
          setRecordSpeed={setRecordSpeed}
          initMute={muteVideoWhenRecording}
          setMuteWhenRecording={setMuteVideoWhenRecording}
        />
      )}
      {showNoVocabFoundTooltip && (
        <TooltipModal
          isVisible={showNoVocabFoundTooltip}
          onRequestClose={() => setShowNoVocabFoundTooltip(false)}
        >
          <Text style={styles.noVocabFoundTooltipText}>
            Vocab is in this segment or a previous segment
          </Text>
        </TooltipModal>
      )}
    </>
  );
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  transcriptContainer: {
    flex: 1,
  },
  settingsButton: {
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "grey",
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderRadius: 24,
  },
  errorContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: "#ff4757",
    borderRadius: 8,
  },
  errorText: {
    color: "#fff",
    textAlign: "center",
  },
  noVocabFoundTooltipText: {
    color: "#fff",
    textAlign: "center",
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#3d3a52",
    borderRadius: 24,
    gap: 8,
  },
  rightArrowContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: 16,
  },
  recordButtonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "600",
  },
  processingContainer: {
    alignItems: "center",
    marginTop: 24,
    gap: 12,
  },
  processingText: {
    color: "#666",
    fontSize: 14,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  recordButtonContainer: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  playSegmentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3d3a52",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    alignSelf: "center",
    marginTop: 16,
  },
  playSegmentButtonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "600",
  },
  sentenceNavContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 40,
    marginTop: 16,
  },
  prevSentenceButton: {
    flexDirection: "row",
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "black",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderRadius: 24,
    gap: 8,
    alignSelf: "center",
  },
  nextSentenceButton: {
    flexDirection: "row",
    backgroundColor: "#4ade80",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: "#4ade80",
    borderRadius: 24,
    gap: 8,
    alignSelf: "center",
  },
  navButtonDisabled: {
    opacity: 0.5,
    borderColor: "#ccc",
  },
  navButtonTextDisabled: {
    color: "#ccc",
  },
  sentenceIndicator: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ShadowTab;
