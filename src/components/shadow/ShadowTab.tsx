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
import {
  findNextSegmentWithVocab,
  findSegmentAndSentenceByTime,
  findSentenceWithVocab,
  findTimesForVocab,
  normalizeWord,
  splitIntoSentences,
} from "../../helpers";
import ShadowResults from "./ShadowResults";
import VocabList from "../watch/VocabList";
import TooltipModal from "../common/TooltipModal";

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

  const [muteVideoWhenRecording, setMuteVideoWhenRecording] =
    useState<boolean>(true);

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
  const [showNoVocabFoundTooltip, setShowNoVocabFoundTooltip] =
    useState<boolean>(false);
  // Track if recording should auto-stop when segment ends
  const shouldAutoStopRef = useRef<boolean>(false);

  // Seek detection: track previous time to detect large jumps (manual seeks)
  const prevTimeRef = useRef<number>(-1);
  // Guard to ignore time updates while transitioning between segments
  const isTransitioningRef = useRef<boolean>(false);

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
  const allWords = useSelector(
    (state: RootState) => state.currentVideo?.allWords
  );
  const focusVocabTimes = useMemo(
    () => findTimesForVocab(allWords, currentVideo),
    [currentVideo, allWords]
  );

  // Determine current playback speed based on recording state
  const [currentSpeed, setCurrentSpeed] = useState<number>(playbackSpeed);

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
        const ignoredWords = currentSentenceWords
          .filter((w) => {
            const word = normalizeWord(w.word);
            return word.length <= 2 || normalizeWord(w.translation) === word;
          })
          .map((w) => w.word);

        // Calculate accuracy
        const accuracy = calculateAccuracy(
          spokenWords,
          targetWords,
          ignoredWords
        );

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
    setSentenceEnded(false);
    // Reset prev time so first update in new segment isn't mistaken for a seek
    prevTimeRef.current = -1;
    if (recordingExtensionRef.current) {
      clearTimeout(recordingExtensionRef.current);
      recordingExtensionRef.current = null;
    }
    // Clear the transitioning guard after a brief delay for the WebView to remount
    const transitionTimer = setTimeout(() => {
      isTransitioningRef.current = false;
    }, 500);
    return () => clearTimeout(transitionTimer);
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
    // Ignore time updates while transitioning between segments (prevents feedback loops)
    if (isTransitioningRef.current) {
      return;
    }

    const prevTime = prevTimeRef.current;
    prevTimeRef.current = newTime;

    // Detect manual seek: a large time jump (>2s) that lands outside the current clip.
    // Skip on the very first time update (prevTime === -1) to avoid false positives.
    if (
      prevTime !== -1 &&
      Math.abs(newTime - prevTime) > 2 &&
      clip &&
      (newTime < clip.start - 0.5 || newTime > clip.end + 0.5)
    ) {
      const result = findSegmentAndSentenceByTime(
        newTime,
        currentVideo.segments,
        currentVideo.currentSegment
      );

      if (result) {
        // Lock out further time updates until the WebView remounts
        isTransitioningRef.current = true;

        // Reset local state for the new segment/sentence
        setCurrentSentence(result.sentenceIndex);
        setAccuracyResult(null);
        setSentenceEnded(false);
        setIsRecordingMode(false);
        setError(null);
        if (recordingExtensionRef.current) {
          clearTimeout(recordingExtensionRef.current);
          recordingExtensionRef.current = null;
        }

        dispatch(setSegmentByTime(newTime));
        dispatch(refreshVideoPlayer());
        return;
      }
    }

    if (newTime < sentenceStart) {
      return;
    }
    setTime(newTime);
  };

  // Enter recording mode (shows countdown, then starts recording)
  const handleEnterRecordingMode = () => {
    // Reset previous results
    setAccuracyResult(null);
    setError(null);
    handleSetTime(sentenceStart);
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
    shouldAutoStopRef.current = true;
    await startRecording();
    refreshVideoPlayerAndState(recordSpeed, muteVideoWhenRecording);
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
        setCurrentSentence(sentences.length - 1);
        handlePreviousSegment();
      }
    } else {
      // Move to previous sentence within the same segment
      setCurrentSentence((prev) => prev - 1);
      setAccuracyResult(null);
      setSentenceEnded(false);
      // Clear any existing timer
      if (recordingExtensionRef.current) {
        clearTimeout(recordingExtensionRef.current);
        recordingExtensionRef.current = null;
      }
      refreshVideoPlayerAndState(playbackSpeed, false);
    }
  };

  const refreshVideoPlayerAndState = (speed: number, muted: boolean) => {
    setCurrentSpeed(speed);
    setIsVideoMuted(muted);
    dispatch(refreshVideoPlayer());
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
      // Clear any existing timer
      if (recordingExtensionRef.current) {
        clearTimeout(recordingExtensionRef.current);
        recordingExtensionRef.current = null;
      }
      refreshVideoPlayerAndState(playbackSpeed, false);
    }
  };

  const handlePlaySnippetAgain = () => {
    setIsRecordingMode(false);
    handleSetTime(sentenceStart);
    setAccuracyResult(null);
    setSentenceEnded(false);
    if (recordingExtensionRef.current) {
      clearTimeout(recordingExtensionRef.current);
      recordingExtensionRef.current = null;
    }
    refreshVideoPlayerAndState(playbackSpeed, false);
  };

  const handleSettingsToggle = () => {
    setIsSettingsVisible(!isSettingsVisible);
  };

  const handleSkipToVocab = (word: SegmentWord) => {
    const [nextSegment, nextFocusVocabTime] = findNextSegmentWithVocab(
      focusVocabTimes,
      word,
      currentVideo.segments,
      currentVideo.currentSegment
    );
    if (nextSegment && nextFocusVocabTime) {
      const sentence = findSentenceWithVocab(
        nextSegment,
        nextFocusVocabTime.start
      );
      if (sentence && sentence >= 0) {
        setCurrentSentence(sentence);
        setSentenceEnded(false);
        setAccuracyResult(null);
        if (recordingExtensionRef.current) {
          clearTimeout(recordingExtensionRef.current);
          recordingExtensionRef.current = null;
        }
        // setTime(nextSegment.words[sentence].start);
        // dispatch(setSegmentByTime(nextSegment.words[sentence].start));
        const sentences = splitIntoSentences(nextSegment.words);
        handleSetTime(sentences[sentence][0].start);
        return;
      }
    }
    setShowNoVocabFoundTooltip(true);
  };

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

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
            <ShadowResults
              accuracyResult={accuracyResult}
              handleEnterRecordingMode={handleEnterRecordingMode}
              handleNextSentence={handleNextSentence}
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

                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={handleSettingsToggle}
                >
                  <MaterialIcons name="settings" size={24} color="grey" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.prevSentenceButton}
                  onPress={handleNextSentence}
                >
                  <MaterialIcons name="chevron-right" size={24} color="black" />
                </TouchableOpacity>
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
                  <MaterialIcons name="mic" size={20} color="red" />
                  <Text style={styles.recordButtonText}>Record Yourself</Text>
                </TouchableOpacity>
              </View>
              <VocabList
                vocab={focusVocabTimes}
                time={time}
                onSkipToVocab={handleSkipToVocab}
                header="Skip to selected vocab"
              />
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
