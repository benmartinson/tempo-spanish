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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TextInput,
  LayoutAnimation,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useSelector, useDispatch } from "react-redux";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAuth } from "@clerk/clerk-expo";
import { RootState, SegmentWord } from "../../types";
import SelectVideoPrompt from "../common/SelectVideoPrompt";
import FullSegmentTranscriptBubble from "../watch/FullSegmentTranscriptBubble";
import { useRecording } from "../useRecording";
import {
  sendAudioForTranscription,
  calculateAccuracy,
  uploadAudioToStorage,
  playAudioFromStorage,
  trimSilenceFromAudio,
} from "../streaming_helpers";
import { AccuracyResult } from "../../types";
import SettingsModal from "./SettingsModal";
import CountdownTimer from "./CountdownTimer";
import {
  capitalize,
  findSentenceWithVocab,
  isInterestingVocab,
  normalizeWord,
  splitIntoSentences,
  stripPunctuation,
} from "../../helpers";
import ShadowResults from "./ShadowResults";
import VocabList from "../watch/VocabList";
import TooltipModal from "../common/TooltipModal";
import NavSwitcher from "../common/NavSwitcher";
import { useSupabaseWithClerk } from "../../../utils/supabase";
import FeaturedVocab from "../watch/FeaturedVocab";
import WordHints from "../common/WordHints";
import Foundation from "@expo/vector-icons/Foundation";
import FocusSentenceRequest from "./FocusSentenceRequest";

interface ShadowTabProps {
  time: number;
  handleNextSentence: () => void;
  handlePreviousSentence: () => void;
  isActive?: boolean;
  playSentence: () => void;
  setPlayerMuted: (muted: boolean) => void;
  setPlayerSpeed: (speed: number) => void;
  pausePlayer: () => void;
  isKeyboardVisible: boolean;
  playWordSnippet: (word: SegmentWord) => void;
  isPlayingWordSnippet: boolean;
  unknownWords: SegmentWord[];
  onPlayClip?: (time: number) => void;
}

const ShadowTab: React.FC<ShadowTabProps> = ({
  time,
  handleNextSentence: parentHandleNextSentence,
  handlePreviousSentence: parentHandlePreviousSentence,
  isActive = true,
  playSentence,
  playWordSnippet,
  setPlayerMuted,
  setPlayerSpeed,
  pausePlayer,
  isKeyboardVisible,
  isPlayingWordSnippet,
  unknownWords,
  onPlayClip,
}) => {
  const currentVideo = useSelector((state: RootState) => state.currentVideo);

  const currentSentenceIndex = currentVideo ? currentVideo.currentSentence : 0;
  const currentSentenceObject = currentVideo
    ? { ...currentVideo.sentences[currentSentenceIndex] }
    : null;
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const recordingExtensionRef = useRef<NodeJS.Timeout | null>(null);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isShowingWordHints, setIsShowingWordHints] = useState<boolean>(true);

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
  const [previousResults, setPreviousResults] = useState<
    (AccuracyResult & { recordingId: string }) | null
  >(null);
  const [isSettingsVisible, setIsSettingsVisible] = useState<boolean>(false);
  const [isRecordingMode, setIsRecordingMode] = useState<boolean>(false);
  const [sentenceEnded, setSentenceEnded] = useState<boolean>(false);
  const [showNoVocabFoundTooltip, setShowNoVocabFoundTooltip] =
    useState<boolean>(false);
  const isTransitioningRef = useRef<boolean>(false);
  const [nextSentenceCountdown, setNextSentenceCountdown] = useState<number>(0);
  const [hasPlayedSentence, setHasPlayedSentence] = useState<boolean>(false);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(
    null,
  );
  const [isPlayingRecording, setIsPlayingRecording] = useState<boolean>(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isTrimmingAudio, setIsTrimmingAudio] = useState<boolean>(false);
  const [currentUnknownWordIndex, setCurrentUnknownWordIndex] =
    useState<number>(0);
  const currentUnknownWord = unknownWords[currentUnknownWordIndex];
  const [showShadowInstructions, setShowShadowInstructions] =
    useState<boolean>(false);
  const [isFocusSentenceExpanded, setIsFocusSentenceExpanded] =
    useState<boolean>(false);

  // Text input state
  const [userAnswer, setUserAnswer] = useState<string>("");

  const calculateAccuracyFromWords = useCallback(
    (spokenWords: string[]) => {
      const targetWords = currentSentenceObject?.words.map((w) => {
        return w.word;
      });

      const accuracy = calculateAccuracy(spokenWords, targetWords);
      return {
        ...accuracy,
        spokenSentence: spokenWords.join(" "),
        targetSentence: capitalize(currentSentenceObject?.text),
      };
    },
    [currentSentenceObject?.words],
  );

  const saveShadowResult = useCallback(
    async (spokenWords: string[]) => {
      if (!supabase || !userId || !currentVideo) return;

      try {
        await supabase.from("user_shadow_result").upsert(
          {
            user_id: userId,
            video_id: parseInt(currentVideo.recordId),
            sentence: currentSentenceIndex,
            spoken_words: spokenWords.join(" "),
          },
          { onConflict: "user_id,video_id,sentence" },
        );
      } catch (err) {
        console.error("Failed to save shadow result:", err);
      }
    },
    [supabase, userId, currentVideo, currentSentenceIndex],
  );

  const fetchShadowResult = useCallback(async () => {
    if (!supabase || !userId || !currentVideo) return null;

    try {
      const { data, error } = await supabase
        .from("user_shadow_result")
        .select("spoken_words, recording_id")
        .eq("user_id", userId)
        .eq("video_id", parseInt(currentVideo.recordId))
        .eq("sentence", currentSentenceIndex)
        .single();

      if (error || !data) return null;
      return { spokenWords: data.spoken_words, recordingId: data.recording_id };
    } catch (err) {
      console.error("Failed to fetch shadow result:", err);
      return null;
    }
  }, [supabase, userId, currentVideo, currentSentenceIndex]);

  const loadExistingShadowResult = async () => {
    if (previousResults) {
      setAccuracyResult(previousResults);
      setCurrentRecordingId(previousResults.recordingId || null);
      return;
    }
    const result = await fetchShadowResult();
    if (result) {
      const spokenWords = result.spokenWords.split(/\s+/).filter(Boolean);
      const accuracy = calculateAccuracyFromWords(spokenWords);
      setAccuracyResult(accuracy);
      setCurrentRecordingId(result.recordingId || null);
    }
  };

  useEffect(() => {
    Keyboard.dismiss();
    if (hasPlayedSentence) {
      setHasPlayedSentence(false);
    }
    setCurrentRecordingId(null);
    setIsPlayingRecording(false);
    loadExistingShadowResult();
    setPreviousResults(null);
    setAccuracyResult(null);
    setIsFocusSentenceExpanded(false);

    return () => {
      if (recordingExtensionRef.current) {
        clearTimeout(recordingExtensionRef.current);
      }
    };
  }, [currentSentenceIndex]);

  const handleTrimAndSaveRecording = async (audioUri: string) => {
    setIsTrimmingAudio(true);
    const trimmedAudioUri = trimSilenceFromAudio(audioUri);
    const recordingPath = await uploadAudioToStorage(
      trimmedAudioUri,
      userId,
      currentVideo.recordId,
      currentSentenceIndex,
    );
    setCurrentRecordingId(recordingPath);

    await supabase.from("user_shadow_result").upsert(
      {
        user_id: userId,
        video_id: parseInt(currentVideo.recordId),
        sentence: currentSentenceIndex,
        recording_id: recordingPath,
      },
      { onConflict: "user_id,video_id,sentence" },
    );
    setIsTrimmingAudio(false);
  };

  const handleRecordingComplete = useCallback(
    async (audioUri: string) => {
      if (!currentVideo) return;

      setIsProcessing(true);
      setError(null);

      try {
        const transcriptionResult = await sendAudioForTranscription(audioUri);
        console.log("Transcription result:", transcriptionResult);
        const spokenWords = transcriptionResult.transcript
          .split(/\s+/)
          .filter(Boolean);
        const accuracy = calculateAccuracyFromWords(spokenWords);

        setAccuracyResult(accuracy);
        setAudioUri(audioUri);
        saveShadowResult(spokenWords);
      } catch (err) {
        console.error("Transcription error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to process audio",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [
      calculateAccuracyFromWords,
      saveShadowResult,
      userId,
      currentVideo,
      currentSentenceIndex,
    ],
  );

  const handleTextSubmit = useCallback(() => {
    if (!userAnswer.trim()) return;

    Keyboard.dismiss();
    setIsProcessing(true);
    setError(null);

    try {
      const typedWords = userAnswer.trim().split(/\s+/).filter(Boolean);
      const accuracy = calculateAccuracyFromWords(typedWords);
      setAccuracyResult(accuracy);
      // Save the shadow result to database
      saveShadowResult(typedWords);
      setUserAnswer("");
    } catch (err) {
      console.error("Text comparison error:", err);
      setError(err instanceof Error ? err.message : "Failed to process text");
    } finally {
      setIsProcessing(false);
    }
  }, [userAnswer, calculateAccuracyFromWords, saveShadowResult]);

  const handleResetAnswer = useCallback(() => {
    setUserAnswer("");
    Keyboard.dismiss();
  }, []);

  const { isRecording, hasPermission, startRecording, stopRecording } =
    useRecording({
      onRecordingComplete: handleRecordingComplete,
      onError: (message) => setError(message),
    });

  const justRecordedRef = useRef(false);

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
    }
  }, [isActive, isRecording]);

  useEffect(() => {
    return () => {
      isTransitioningRef.current = false;
      clearRecordingTimer();
      setIsRecordingMode(false);
      setSentenceEnded(false);
      setIsProcessing(false);
      setAccuracyResult(null);
      setError(null);
      setShowNoVocabFoundTooltip(false);
      setIsSettingsVisible(false);
    };
  }, []);

  useEffect(() => {
    if (
      !isTransitioningRef.current &&
      time >= currentSentenceObject?.end - 0.5 &&
      !sentenceEnded
    ) {
      if (isRecording) {
        setSentenceEnded(true);
        setHasPlayedSentence(true);
      } else if (isActive && isLooping && !justRecordedRef.current) {
        setTimeout(() => {
          handleEnterRecordingMode();
        }, 1000);
      }
    }
  }, [time, currentSentenceObject?.end, isRecording, sentenceEnded]);

  const setJustRecorded = () => {
    setTimeout(() => {
      justRecordedRef.current = false;
    }, 1000);
  };

  const handleShadowNextSentence = () => {
    setAccuracyResult(null);
    setUserAnswer("");
    setPlayerSpeed(playbackSpeed);
    setPlayerMuted(false);
    setIsRecordingMode(false);
    handleResetState();
    setJustRecorded();
    parentHandleNextSentence();
  };

  const handleNextRef = useRef(handleShadowNextSentence);
  useEffect(() => {
    handleNextRef.current = handleShadowNextSentence;
  });

  useEffect(() => {
    if (isActive && isLooping && accuracyResult) {
      setNextSentenceCountdown(5);
      const interval = setInterval(() => {
        setNextSentenceCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleNextRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setNextSentenceCountdown(0);
    }
  }, [isActive, isLooping, accuracyResult]);

  const handleResetState = () => {
    setError(null);
    setAccuracyResult(null);
    setSentenceEnded(false);
    setIsProcessing(false);
    clearRecordingTimer();
  };

  const clearRecordingTimer = () => {
    if (recordingExtensionRef.current) {
      clearTimeout(recordingExtensionRef.current);
      recordingExtensionRef.current = null;
    }
  };

  const handleEnterRecordingMode = () => {
    setPreviousResults(null);
    pausePlayer();
    setPlayerMuted(true);
    setPlayerSpeed(recordSpeed);
    setIsRecordingMode(true);
    handleResetState();
    isTransitioningRef.current = true;
    justRecordedRef.current = true;
  };

  const handleActualStartRecording = async () => {
    await startRecording();
    // playSentence();
    setTimeout(() => {
      isTransitioningRef.current = false;
    }, 1000);
  };

  const handleStopRecording = async (trashed: boolean = false) => {
    pausePlayer();
    setIsRecordingMode(false);
    await stopRecording(trashed);
  };

  const handleShadowPreviousSentence = () => {
    setIsRecordingMode(false);
    setJustRecorded();
    setPlayerSpeed(playbackSpeed);
    setPlayerMuted(false);
    handleResetState();
    parentHandlePreviousSentence();
  };

  const handlePlaySnippetAgain = (word: SegmentWord) => {
    setPlayerMuted(false);
    setJustRecorded();
    setPlayerSpeed(playbackSpeed);
    setIsRecordingMode(false);
    handleResetState();
    if (word) {
      playWordSnippet(word);
    } else {
      playSentence();
    }
  };

  const handlePlayUserRecording = useCallback(async () => {
    if (!currentRecordingId || isPlayingRecording) return;

    setIsPlayingRecording(true);
    try {
      await playAudioFromStorage(currentRecordingId);
    } catch (err) {
      console.error("Failed to play recording:", err);
      setError(err instanceof Error ? err.message : "Failed to play recording");
    } finally {
      // Note: This will be set immediately, but the audio continues playing
      // The playAudioFromStorage function handles cleanup when audio finishes
      setTimeout(() => setIsPlayingRecording(false), 500);
    }
  }, [currentRecordingId, isPlayingRecording]);

  const handleRetry = () => {
    const prevResult = accuracyResult;
    if (prevResult) {
      setPreviousResults({
        ...prevResult,
        recordingId: currentRecordingId || null,
      });
    }
    setAccuracyResult(null);
    setUserAnswer("");
    setCurrentRecordingId(null);
  };

  const handlePreviousResults = () => {
    loadExistingShadowResult();
  };

  const handleWordHintChange = (direction: number) => {
    if (unknownWords.length === 0) return;
    let newIndex = currentUnknownWordIndex + direction;
    if (newIndex < 0) {
      newIndex = unknownWords.length - 1;
    } else if (newIndex >= unknownWords.length) {
      newIndex = 0;
    }
    setCurrentUnknownWordIndex(newIndex);
  };

  if (!currentVideo) {
    return <SelectVideoPrompt />;
  }

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={
          Platform.OS === "ios" ? (isKeyboardVisible ? 128 : 180) : 0
        }
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Sentence Navigation */}
        <NavSwitcher
          onPrev={handleShadowPreviousSentence}
          onNext={handleShadowNextSentence}
          currentIndex={currentSentenceIndex}
          totalItems={currentVideo.sentences.length}
          sentences={currentVideo.sentences}
          onPlayClip={onPlayClip}
          videoId={currentVideo.videoId}
        >
          <Text>
            Segment {currentSentenceIndex + 1} of{" "}
            {currentVideo.sentences.length}
          </Text>
        </NavSwitcher>
        <ScrollView
          style={styles.transcriptContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Recording button or processing indicator */}
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#4ade80" />
              <Text style={styles.processingText}>
                Analyzing your pronunciation...
              </Text>
            </View>
          ) : accuracyResult ? (
            <>
              <ShadowResults
                accuracyResult={accuracyResult}
                handleNextSentence={handleShadowNextSentence}
                handleRetry={handleRetry}
              />
              {nextSentenceCountdown > 0 && (
                <View style={styles.nextSentenceCountdownRefContainer}>
                  <Text style={styles.nextSentenceCountdownRefText}>
                    {nextSentenceCountdown}
                  </Text>
                </View>
              )}
            </>
          ) : isRecordingMode ? (
            <>
              <CountdownTimer
                onStartRecording={handleActualStartRecording}
                onStopRecording={() => handleStopRecording(false)}
                sentenceEnded={sentenceEnded}
                bufferDuration={0}
                countdownDuration={0}
              />
              {/* <FullSegmentTranscriptBubble
                words={currentSentence.words}
                time={time}
                showFullText={true}
                mode="video"
              /> */}
            </>
          ) : (
            <>
              {/* <FullSegmentTranscriptBubble
                words={currentSentence.words}
                time={time}
                mode="video"
              /> */}
              <View style={styles.recordButtonContainer}>
                <View style={styles.playSegmentButton}>
                  <TouchableOpacity
                    style={styles.playSegmentButtonInner}
                    onPress={() => handlePlaySnippetAgain(null)}
                  >
                    <Text style={styles.playSegmentButtonText}>
                      {hasPlayedSentence ? "Play Sentence" : "Replay"}
                    </Text>
                    <MaterialIcons name="play-arrow" size={20} color="black" />
                  </TouchableOpacity>
                </View>
                <View style={styles.settingsButtonContainer}>
                  {previousResults && (
                    <TouchableOpacity
                      style={styles.previousResultsButtonInner}
                      onPress={handlePreviousResults}
                      disabled={isPlayingRecording}
                    >
                      <Foundation
                        name="clipboard-notes"
                        size={32}
                        color="#4a69bd"
                      />
                    </TouchableOpacity>
                  )}
                  <FocusSentenceRequest
                    markedId={
                      currentVideo.focusSentences.find(
                        (s) =>
                          s.segment_index === currentSentenceIndex &&
                          s.sentence_index === currentSentenceIndex,
                      )?.id ?? null
                    }
                    sentenceIndex={currentSentenceIndex}
                    translation={currentSentenceObject?.full_translation}
                    sentenceText={currentSentenceObject?.text}
                    segmentIndex={currentSentenceIndex}
                    videoViewId={currentVideo.videoViewId}
                  />
                  <TouchableOpacity onPress={() => setIsSettingsVisible(true)}>
                    <MaterialIcons name="settings" size={32} color="#222222" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowShadowInstructions(true)}
                  >
                    <MaterialIcons name="info" size={32} color="#222222" />
                  </TouchableOpacity>
                </View>
              </View>
              {/* <VocabList
                vocab={focusVocabTimes}
                time={time}
                onSkipToVocab={handleSkipToVocab}
                header="Skip to selected vocab"
              /> */}
            </>
          )}
          {/* Play user recording button - shown when a recording exists */}
          {!isRecordingMode && !isProcessing && (
            <>
              <View style={styles.playRecordingContainer}>
                {accuracyResult && currentRecordingId && (
                  <TouchableOpacity
                    style={styles.playRecordingButton}
                    onPress={handlePlayUserRecording}
                    disabled={isPlayingRecording}
                  >
                    <MaterialIcons
                      name={isPlayingRecording ? "pause" : "headphones"}
                      size={20}
                      color="#4a69bd"
                    />
                    <Text style={styles.playRecordingButtonText}>
                      {isPlayingRecording ? "Playing..." : "Play Recording"}
                    </Text>
                  </TouchableOpacity>
                )}
                {accuracyResult && !currentRecordingId && audioUri && (
                  <TouchableOpacity
                    style={styles.playRecordingButton}
                    onPress={() => handleTrimAndSaveRecording(audioUri)}
                    disabled={isTrimmingAudio}
                  >
                    <Text style={styles.playRecordingButtonText}>
                      {isTrimmingAudio
                        ? "Saving..."
                        : "Save Recording for Playback"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {!accuracyResult && unknownWords.length > 0 && (
                <View style={styles.wordHintsContainer}>
                  <WordHints
                    unknownWords={unknownWords}
                    handlePlayWordSnippet={(word) =>
                      handlePlaySnippetAgain(word)
                    }
                    isPlayingWordSnippet={isPlayingWordSnippet}
                  />
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Input Area - always visible when not in recording mode or showing results */}
        {!accuracyResult && !isProcessing && (
          <View
            style={[
              styles.inputArea,
              { paddingBottom: isKeyboardVisible ? 10 : 40 },
            ]}
          >
            <TextInput
              style={styles.textInput}
              placeholder=""
              placeholderTextColor="#999"
              value={userAnswer}
              onChangeText={setUserAnswer}
              autoComplete="off"
              autoCorrect={false}
              autoCapitalize="none"
              multiline
              maxLength={500}
              editable={!isRecordingMode}
            />
            <TouchableOpacity
              style={[
                styles.trashButton,
                {
                  backgroundColor:
                    isKeyboardVisible || isRecordingMode ? "white" : "#f0f0f0",
                },
              ]}
              onPress={() => {
                if (isRecordingMode) {
                  handleStopRecording(true);
                }
                handleResetAnswer();
              }}
            >
              <FontAwesome
                name="trash-o"
                size={22}
                color={isKeyboardVisible || isRecordingMode ? "red" : "#aaa"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.micButton}
              onPress={handleEnterRecordingMode}
              disabled={!hasPermission || isProcessing}
            >
              <MaterialIcons name="mic" size={22} color="red" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sendButton,
                !userAnswer.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleTextSubmit}
              disabled={!userAnswer.trim()}
            >
              <MaterialIcons
                name="send"
                size={22}
                color={userAnswer.trim() ? "#fff" : "#aaa"}
              />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
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
      {showShadowInstructions && (
        <TooltipModal
          isVisible={showShadowInstructions}
          onRequestClose={() => setShowShadowInstructions(false)}
        >
          <Text style={styles.shadowInstructionsText}>
            Listen to the sentence until memorized and then press the microphone
            button to record your pronunciation of it...
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
  instructionContainer: {
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 24,
  },
  shadowInstructionsText: {
    color: "white",
    textAlign: "center",
    fontSize: 14,
  },
  wordHintsContainer: {
    marginTop: 0,
  },
  instructionText: {
    color: "#666",
    textAlign: "center",
    fontSize: 14,
  },
  settingsButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
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
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  playSegmentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  playSegmentButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3d3a52",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
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
  nextSentenceCountdownRefContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  nextSentenceCountdownRefText: {
    fontSize: 24,
    fontWeight: "600",
  },
  // Input Area styles
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fafafa",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: "#222",
    borderWidth: 1,
    borderColor: "#ddd",
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#4a69bd",
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#e0e0e0",
  },
  trashButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  micButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  playRecordingContainer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  previousResultsButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 4,
  },
  previousResultsButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
    paddingVertical: 12,
    borderRadius: 24,
  },
  previousResultsText: {
    color: "#4a69bd",
    fontSize: 14,
    fontWeight: "500",
  },
  playRecordingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#e8f0fe",
    borderWidth: 1,
    borderColor: "#4a69bd",
    gap: 8,
  },
  playRecordingButtonText: {
    color: "#4a69bd",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default ShadowTab;
