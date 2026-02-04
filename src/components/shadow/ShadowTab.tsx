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
import { RootState, SegmentWord } from "../../types";
import {
  setSegmentByTime,
  setNextSegment,
  setPreviousSegment,
  refreshVideoPlayer,
} from "../../store/actions/dataActions";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import SelectedVideoBanner from "../common/SelectedVideoBanner";
import YouTubePlayer from "../common/YouTubePlayer";
import FullSegmentTranscriptBubble from "../watch/FullSegmentTranscriptBubble";
import { useRecording } from "../useRecording";
import {
  sendAudioForTranscription,
  calculateAccuracy,
  AccuracyResult,
} from "../streaming_helpers";
import SettingsModal from "./SettingsModal";
import CountdownTimer from "./CountdownTimer";

// Helper function to split words into sentences based on punctuation
const splitIntoSentences = (words: SegmentWord[]): SegmentWord[][] => {
  const sentences: SegmentWord[][] = [];
  let currentSentenceWords: SegmentWord[] = [];

  for (const word of words) {
    currentSentenceWords.push(word);
    // Check if word ends with sentence-ending punctuation
    if (/[.!?]$/.test(word.word)) {
      sentences.push(currentSentenceWords);
      currentSentenceWords = [];
    }
  }
  // Handle remaining words (last sentence without punctuation)
  if (currentSentenceWords.length > 0) {
    sentences.push(currentSentenceWords);
  }
  return sentences;
};

interface ShadowTabProps {
  segmentId?: string;
}
const ShadowTab: React.FC<ShadowTabProps> = ({ segmentId }) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);
  const clip = currentVideo?.segments[segmentId || currentVideo.currentSegment];
  const [time, setTime] = useState<number>(0);
  const videoRefreshKey = useSelector(
    (state: RootState) => state.videoRefreshKey
  );
  const dispatch = useDispatch();

  // Sentence tracking state
  const [currentSentence, setCurrentSentence] = useState<number>(0);
  const [sentenceEnded, setSentenceEnded] = useState<boolean>(false);
  const recordingExtensionRef = useRef<NodeJS.Timeout | null>(null);

  // Speed control state
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [recordSpeed, setRecordSpeed] = useState<number>(0.75);

  // Recording and transcription state
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [accuracyResult, setAccuracyResult] = useState<AccuracyResult | null>(
    null
  );
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState<boolean>(false);
  // Tracks when we're in recording mode (includes countdown, recording, and buffer phases)
  const [isRecordingMode, setIsRecordingMode] = useState<boolean>(false);

  // Track if recording should auto-stop when segment ends
  const shouldAutoStopRef = useRef<boolean>(false);

  const clipWords = clip?.words || [];

  // Split clip words into sentences and derive current sentence data
  const sentences = useMemo(() => splitIntoSentences(clipWords), [clipWords]);
  const currentSentenceWords = sentences[currentSentence] || [];
  const sentenceStart = currentSentenceWords[0]?.start ?? clip?.start ?? 0;
  let sentenceEnd =
    currentSentenceWords[currentSentenceWords.length - 1]?.end ??
    clip?.end ??
    0;
  sentenceEnd = (parseFloat(sentenceEnd.toFixed(1)) + 0.1).toString();
  const isLastSentence = currentSentence >= sentences.length - 1;
  const isFirstSentence = currentSentence === 0;
  const isFirstSegment = currentVideo?.currentSegment === 0;
  const sentenceTimeRemaining = Math.floor(Math.max(sentenceEnd - time, 0));

  // Determine current playback speed based on recording state
  const currentSpeed = isVideoMuted ? recordSpeed : playbackSpeed;

  // Handle recording completion - send audio for transcription
  const handleRecordingComplete = useCallback(
    async (audioUri: string) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Send audio to backend for transcription
        const result = await sendAudioForTranscription(audioUri);

        // Extract words from transcript
        const spokenWords = result.transcript.split(/\s+/).filter(Boolean);

        // Get target words from current sentence
        const targetWords = currentSentenceWords.map((w) => w.word);

        // Calculate accuracy
        const accuracy = calculateAccuracy(spokenWords, targetWords);

        setAccuracyResult(accuracy);
      } catch (err) {
        console.error("Transcription error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to process audio"
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [currentSentenceWords]
  );

  const { isRecording, hasPermission, startRecording, stopRecording } =
    useRecording({
      onRecordingComplete: handleRecordingComplete,
      onError: (message) => setError(message),
    });

  // Reset state when segment changes
  useEffect(() => {
    setError(null);
    setAccuracyResult(null);
    setIsProcessing(false);
    setIsVideoMuted(false);
    setIsRecordingMode(false);
    shouldAutoStopRef.current = false;
    setCurrentSentence(0);
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

  const handleSetTime = (newTime: number) => {
    // if (newTime >= 1 && (newTime <= clip?.start || newTime >= clip?.end)) {
    // this causes bugs
    //   console.log("newTime", newTime);
    //   console.log("clip", clip?.start, clip?.end);
    //   dispatch(setSegmentByTime(newTime));
    //   return;
    // }
    setTime(newTime);
  };

  // Enter recording mode (shows countdown, then starts recording)
  const handleEnterRecordingMode = () => {
    // Reset previous results
    setTime(sentenceStart);
    setAccuracyResult(null);
    setError(null);
    setSentenceEnded(false);
    setIsRecordingMode(true);
    // Clear any existing timer
    if (recordingExtensionRef.current) {
      clearTimeout(recordingExtensionRef.current);
      recordingExtensionRef.current = null;
    }
  };

  // Called by CountdownTimer after 3-second countdown
  const handleActualStartRecording = async () => {
    setTime(sentenceStart);
    shouldAutoStopRef.current = true;
    setIsVideoMuted(true);
    await startRecording();
    dispatch(refreshVideoPlayer());
  };

  // Called by CountdownTimer after buffer countdown completes
  const handleStopRecording = async () => {
    shouldAutoStopRef.current = false;
    setIsRecordingMode(false);
    // pause video
    await stopRecording();
    // Keep muted until user takes action (results will be shown)
  };

  const handleNextSegment = () => {
    // Move to next segment and unmute
    setIsVideoMuted(false);
    dispatch(setNextSegment());
  };

  const handlePreviousSegment = () => {
    // Move to previous segment and unmute
    setIsVideoMuted(false);
    dispatch(setPreviousSegment());
  };

  const handlePreviousSentence = () => {
    if (isFirstSentence) {
      if (!isFirstSegment) {
        // Move to previous segment's last sentence
        handlePreviousSegment();
        // Note: currentSentence will reset to 0 due to segment change useEffect
        // We need to set it to last sentence after segment loads
      }
      // If first segment and first sentence, do nothing
    } else {
      // Move to previous sentence within the same segment
      setCurrentSentence((prev) => prev - 1);
      setAccuracyResult(null);
      setSentenceEnded(false);
      setIsVideoMuted(false);
      // Clear any existing timer
      if (recordingExtensionRef.current) {
        clearTimeout(recordingExtensionRef.current);
        recordingExtensionRef.current = null;
      }
      dispatch(refreshVideoPlayer());
    }
  };

  const handleNextSentence = () => {
    if (isLastSentence) {
      // Move to next segment if this was the last sentence
      handleNextSegment();
    } else {
      // Move to next sentence within the same segment
      setCurrentSentence((prev) => prev + 1);
      setAccuracyResult(null);
      setSentenceEnded(false);
      setIsVideoMuted(false);
      // Clear any existing timer
      if (recordingExtensionRef.current) {
        clearTimeout(recordingExtensionRef.current);
        recordingExtensionRef.current = null;
      }
      dispatch(refreshVideoPlayer());
    }
  };

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

  const handlePlaySnippetAgain = () => {
    setIsVideoMuted(false);
    setIsRecordingMode(false);
    setTime(sentenceStart);
    setAccuracyResult(null);
    setSentenceEnded(false);
    if (recordingExtensionRef.current) {
      clearTimeout(recordingExtensionRef.current);
      recordingExtensionRef.current = null;
    }
    dispatch(refreshVideoPlayer());
  };

  const handleSettingsToggle = () => {
    setIsSettingsVisible(!isSettingsVisible);
  };

  return (
    <>
      <SelectedVideoBanner />
      <View style={styles.container}>
        <View style={styles.videoContainer}>
          <YouTubePlayer
            clip={{
              ...clip,
              start: sentenceStart,
              end: sentenceEnd,
              videoId: currentVideo.videoId,
            }}
            videoId={currentVideo.videoId}
            autoplay={true}
            refreshKey={videoRefreshKey}
            setTime={handleSetTime}
            muted={isVideoMuted}
            playbackSpeed={currentSpeed}
          />
        </View>

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
            // Show results
            <View style={styles.resultsContainer}>
              <View style={styles.accuracyCircle}>
                <Text style={styles.accuracyPercentage}>
                  {accuracyResult.percentage}%
                </Text>
                <Text style={styles.accuracyLabel}>Accuracy</Text>
              </View>
              <Text style={styles.accuracyDetails}>
                {accuracyResult.matchedWords} of {accuracyResult.totalWords}{" "}
                words matched
              </Text>

              {/* Action buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.tryAgainButton]}
                  onPress={handleEnterRecordingMode}
                >
                  <MaterialIcons name="replay" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Re-Try Recording</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.nextButton]}
                  onPress={handleNextSentence}
                >
                  <Text style={styles.actionButtonText}>Next Sentence</Text>
                  <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.playAgainButton]}
                  onPress={handlePlaySnippetAgain}
                >
                  <Text style={styles.playAgainButtonText}>
                    Re-Play Sentence
                  </Text>
                  <MaterialIcons name="play-arrow" size={20} color="black" />
                </TouchableOpacity>
              </View>
            </View>
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
                mode="video"
              />
            </>
          ) : (
            <>
              {/* Sentence Navigation */}
              <View style={styles.sentenceNavContainer}>
                <TouchableOpacity
                  style={[
                    styles.prevSentenceButton,
                    isFirstSentence &&
                      isFirstSegment &&
                      styles.navButtonDisabled,
                  ]}
                  onPress={handlePreviousSentence}
                  disabled={isFirstSentence && isFirstSegment}
                >
                  <MaterialIcons
                    name="chevron-left"
                    size={24}
                    color={isFirstSentence && isFirstSegment ? "#ccc" : "black"}
                  />
                </TouchableOpacity>

                <View style={styles.rightArrowContainer}>
                  <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={handleSettingsToggle}
                  >
                    <MaterialIcons name="settings" size={24} color="grey" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.nextSentenceButton}
                    onPress={handleNextSentence}
                  >
                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color="white"
                    />
                  </TouchableOpacity>
                </View>
              </View>
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
                  <Text style={styles.recordButtonText}>Record Yourself</Text>
                </TouchableOpacity>
              </View>
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
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  transcriptContainer: {
    flex: 1,
  },
  videoContainer: {
    height: 230,
    backgroundColor: "#000",
    position: "relative",
    marginTop: 0,
  },
  settingsButton: {
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "grey",
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#3d3a52",
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
    color: "#fff",
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
  resultsContainer: {
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 16,
  },
  accuracyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#2d2a40",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  accuracyPercentage: {
    color: "#4ade80",
    fontSize: 32,
    fontWeight: "700",
  },
  accuracyLabel: {
    color: "#fff",
    fontSize: 14,
    opacity: 0.8,
  },
  accuracyDetails: {
    color: "#666",
    fontSize: 14,
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  tryAgainButton: {
    backgroundColor: "#3d3a52",
  },
  playAgainButton: {
    backgroundColor: "white",
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "#3d3a52",
  },
  playAgainButtonText: {
    color: "black",
    fontSize: 14,
    fontWeight: "600",
  },
  nextButton: {
    backgroundColor: "#4ade80",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    alignSelf: "center",
    marginTop: 16,
  },
  playSegmentButtonText: {
    color: "black",
    fontSize: 14,
    fontWeight: "600",
  },
  sentenceNavContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
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
    paddingVertical: 12,
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
    paddingVertical: 12,
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
