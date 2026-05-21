import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAuth } from "@clerk/clerk-expo";
import * as FileSystem from "expo-file-system/legacy";
import { useDispatch, useSelector } from "react-redux";
import type {
  AccuracyResult,
  Channel,
  LanguageCode,
  RootState,
  Video,
} from "../../types";
import type { SegmentWord } from "../../types";
import RecordingControls from "../common/RecordingControls";
import SignInPromptModal from "../common/SignInPromptModal";
import ShadowResults from "../shadow/ShadowResults";
import { calculateAccuracy } from "../../helpers/calculate_accuracy";
import { removeSpecialPunctuationFromPassage } from "../../helpers/helpers";
import { sendAudioForTranscription } from "../../helpers/streaming_helpers";
import { setUserCredits } from "../../store/actions/dataActions";
import { useRecording } from "../../hooks/useRecording";
import ChooseComposition from "./ChooseComposition";
import Memorizer from "./Memorizer";
import type { CompositionController } from "./useCompositionController";
import type { TranscriptPhraseMatch, UserComposition } from "../../requests";

export type StudioMode = "write" | "memorize";

interface ComposerProps {
  composition: CompositionController;
  isOpeningVideoComposition?: boolean;
  isMemorizeFullScreen?: boolean;
  onToggleMemorizeFullScreen?: () => void;
  onExitMemorizeFullScreen?: () => void;
  onQuickRefreshSavedComposition?: (
    composition: UserComposition,
  ) => Promise<void>;
  onPreviewVideoMatch?: (match: TranscriptPhraseMatch | null) => void;
  allChannels: Channel[];
  publicSupabase: any;
  targetLanguage: LanguageCode | null;
  targetLanguageVideos: Video[];
  memorizePlaybackTime?: number;
  memorizePlayerIsPlaying?: boolean;
}

const Composer: React.FC<ComposerProps> = (props) => {
  const {
    composition: cps,
    isOpeningVideoComposition = false,
    isMemorizeFullScreen = false,
    onToggleMemorizeFullScreen,
    onExitMemorizeFullScreen,
    onQuickRefreshSavedComposition,
    onPreviewVideoMatch,
    allChannels,
    publicSupabase,
    targetLanguage,
    targetLanguageVideos,
    memorizePlaybackTime = 0,
    memorizePlayerIsPlaying = false,
  } = props;
  const dispatch = useDispatch();
  const { isSignedIn } = useAuth();
  const userCredits = useSelector((state: RootState) => state.userCredits);
  const [showVideoWriteInfo, setShowVideoWriteInfo] = useState(false);
  const [draftSegmentStart, setDraftSegmentStart] = useState("");
  const [draftSegmentEnd, setDraftSegmentEnd] = useState("");
  const [memorizeRecordingMessage, setMemorizeRecordingMessage] = useState<
    string | null
  >(null);
  const [memorizeRecordingTranscript, setMemorizeRecordingTranscript] =
    useState<string | null>(null);
  const [memorizeAccuracyResult, setMemorizeAccuracyResult] =
    useState<AccuracyResult | null>(null);
  const [memorizeRecordingAudioUri, setMemorizeRecordingAudioUri] = useState<
    string | null
  >(null);
  const [memorizeRecordingSeconds, setMemorizeRecordingSeconds] = useState(0);
  const [showRecordingSignInPrompt, setShowRecordingSignInPrompt] =
    useState(false);
  const [showWordSignInPrompt, setShowWordSignInPrompt] = useState(false);
  const [isProcessingMemorizeRecording, setIsProcessingMemorizeRecording] =
    useState(false);
  const hideComposerChrome = isMemorizeFullScreen && cps.mode === "memorize";
  const memorizeTargetWords = useMemo(
    () =>
      removeSpecialPunctuationFromPassage(
        cps.memorizeWords
          .map((word) => word.word)
          .join(" ")
          .replace(/\s+/g, " "),
      )
        .split(/\s+/)
        .filter(Boolean),
    [cps.memorizeWords],
  );
  const memorizeRecordingCreditsUsed = Math.max(
    1,
    Math.ceil(Math.max(1, memorizeRecordingSeconds) / 30),
  );

  const submitMemorizeRecording = useCallback(
    async (uri: string) => {
      setIsProcessingMemorizeRecording(true);
      setMemorizeRecordingMessage(null);
      setMemorizeRecordingTranscript(null);
      setMemorizeAccuracyResult(null);
      setMemorizeRecordingAudioUri(null);

      let safeUri = uri;
      if (Platform.OS !== "web") {
        const stableUri = `${FileSystem.cacheDirectory}composer_memorize_recording_${Date.now()}.wav`;
        try {
          await FileSystem.copyAsync({ from: uri, to: stableUri });
          safeUri = (await FileSystem.getInfoAsync(stableUri)).exists
            ? stableUri
            : uri;
        } catch {
          console.warn("Could not copy recording, using original URI");
        }
      }

      try {
        const result = await sendAudioForTranscription(
          safeUri,
          targetLanguage ?? "es",
          "duration",
        );
        const spokenWords = result.transcript.split(/\s+/).filter(Boolean);
        const accuracy = calculateAccuracy(
          spokenWords,
          memorizeTargetWords,
          [],
        );
        const creditsCharged = result.credits_charged ?? 1;
        dispatch(setUserCredits(Math.max(0, userCredits - creditsCharged)));
        setMemorizeAccuracyResult({
          ...accuracy,
          targetSentence: memorizeTargetWords.join(" "),
        });
        setMemorizeRecordingAudioUri(safeUri);
        setMemorizeRecordingTranscript(result.transcript.trim());
        setMemorizeRecordingMessage(
          `Transcribed. ${creditsCharged} credit${
            creditsCharged === 1 ? "" : "s"
          } used.`,
        );
      } catch (error) {
        const message =
          error instanceof Error && error.message.includes("403")
            ? "Not enough credits for this recording. Shorten it or add credits."
            : "Could not transcribe that recording.";
        setMemorizeRecordingMessage(message);
      } finally {
        setIsProcessingMemorizeRecording(false);
      }
    },
    [dispatch, memorizeTargetWords, targetLanguage, userCredits],
  );

  const {
    isRecording: isMemorizeRecording,
    hasPermission: hasMemorizeRecordingPermission,
    startRecording: startMemorizeRecording,
    stopRecording: stopMemorizeRecording,
  } = useRecording({
    onRecordingComplete: submitMemorizeRecording,
    onError: setMemorizeRecordingMessage,
  });

  useEffect(() => {
    if (!isMemorizeRecording) return;

    const interval = setInterval(() => {
      setMemorizeRecordingSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isMemorizeRecording]);

  const resetMemorizeRecordingResult = useCallback(() => {
    setMemorizeAccuracyResult(null);
    setMemorizeRecordingAudioUri(null);
    setMemorizeRecordingTranscript(null);
    setMemorizeRecordingMessage(null);
    setMemorizeRecordingSeconds(0);
  }, []);

  const handleMemorizeRecordingMicPress = useCallback(async () => {
    if (isProcessingMemorizeRecording) return;

    if (isMemorizeRecording) {
      await stopMemorizeRecording(false);
      return;
    }

    if (!isSignedIn) {
      setMemorizeRecordingTranscript(null);
      setMemorizeAccuracyResult(null);
      setMemorizeRecordingAudioUri(null);
      setMemorizeRecordingMessage(null);
      setShowRecordingSignInPrompt(true);
      return;
    }

    if (userCredits <= 0) {
      setMemorizeRecordingTranscript(null);
      setMemorizeAccuracyResult(null);
      setMemorizeRecordingAudioUri(null);
      setMemorizeRecordingMessage(
        "Add credits before transcribing recordings.",
      );
      return;
    }

    setMemorizeRecordingTranscript(null);
    setMemorizeAccuracyResult(null);
    setMemorizeRecordingAudioUri(null);
    setMemorizeRecordingMessage(null);
    setMemorizeRecordingSeconds(0);
    await startMemorizeRecording();
  }, [
    isMemorizeRecording,
    isProcessingMemorizeRecording,
    isSignedIn,
    startMemorizeRecording,
    stopMemorizeRecording,
    userCredits,
  ]);

  const handleMemorizeRecordingTrashPress = useCallback(async () => {
    await stopMemorizeRecording(true);
    resetMemorizeRecordingResult();
  }, [resetMemorizeRecordingResult, stopMemorizeRecording]);

  const handleWriteModePress = () => {
    resetMemorizeRecordingResult();
    if (cps.isVideoMode && cps.mode !== "write") {
      setShowVideoWriteInfo(true);
    }
    cps.setMode("write");
  };
  const handleMemorizeModePress = () => {
    resetMemorizeRecordingResult();
    cps.setMode("memorize");
  };
  const handleRelayHighlightedWords = useCallback(
    (words: SegmentWord[]) => {
      if (!isSignedIn) {
        setShowWordSignInPrompt(true);
        return false;
      }
      if (isMemorizeFullScreen && words.length) {
        onExitMemorizeFullScreen?.();
      }
      cps.handleRelayHighlightedWords(words);
      return true;
    },
    [cps, isMemorizeFullScreen, isSignedIn, onExitMemorizeFullScreen],
  );

  useEffect(() => {
    if (isMemorizeFullScreen && cps.mode !== "memorize") {
      onExitMemorizeFullScreen?.();
    }
  }, [cps.mode, isMemorizeFullScreen, onExitMemorizeFullScreen]);

  useEffect(() => {
    if (!cps.transcriptRange) {
      setDraftSegmentStart("");
      setDraftSegmentEnd("");
      return;
    }

    setDraftSegmentStart(String(cps.transcriptRange.startDisplayIndex));
    setDraftSegmentEnd(String(cps.transcriptRange.endDisplayIndex));
  }, [
    cps.transcriptRange?.endDisplayIndex,
    cps.transcriptRange?.startDisplayIndex,
  ]);

  const commitSegmentStart = () => {
    if (!cps.transcriptRange) return;
    resetMemorizeRecordingResult();
    cps.transcriptRange.onStartSegmentChange(draftSegmentStart);
  };

  const commitSegmentEnd = () => {
    if (!cps.transcriptRange) return;
    resetMemorizeRecordingResult();
    cps.transcriptRange.onEndSegmentChange(draftSegmentEnd);
  };

  const handleNewCompositionPress = () => {
    resetMemorizeRecordingResult();
    cps.handleNewComposition();
  };

  return (
    <View style={styles.editorPane}>
      {!hideComposerChrome && (
        <View style={styles.paneHeader}>
          {cps.hasChosenComposition && (
            <View style={styles.modeSwitch}>
              <Pressable
                style={[
                  styles.modeButton,
                  cps.mode === "write" && styles.modeButtonActive,
                ]}
                onPress={handleWriteModePress}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={cps.mode === "write" ? "#ffffff" : "#3d3a52"}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    cps.mode === "write" && styles.modeButtonTextActive,
                  ]}
                >
                  Edit
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeButton,
                  cps.mode === "memorize" && styles.modeButtonActive,
                ]}
                onPress={handleMemorizeModePress}
              >
                <MaterialIcons
                  name="psychology"
                  size={17}
                  color={cps.mode === "memorize" ? "#ffffff" : "#3d3a52"}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    cps.mode === "memorize" && styles.modeButtonTextActive,
                  ]}
                >
                  Memorize
                </Text>
              </Pressable>
            </View>
          )}
          <View style={styles.headerActions}>
            {cps.hasChosenComposition && (
              <>
                <Pressable
                  style={styles.newButton}
                  onPress={handleNewCompositionPress}
                >
                  <Ionicons name="add" size={16} color="#3d3a52" />
                  <Text style={styles.newButtonText}>New</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.saveButton,
                    (cps.isSavingComposition || !cps.draft.trim()) &&
                      styles.saveButtonMuted,
                  ]}
                  onPress={cps.saveComposition}
                  disabled={cps.isSavingComposition || !cps.draft.trim()}
                >
                  {cps.isSavingComposition ? (
                    <ActivityIndicator size="small" color="#26705d" />
                  ) : (
                    <Ionicons
                      name={
                        cps.saveCompositionMessage
                          ? "checkmark"
                          : "save-outline"
                      }
                      size={16}
                      color="#26705d"
                    />
                  )}
                  <Text style={styles.saveButtonText}>
                    {cps.saveCompositionMessage || "Save"}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      {!hideComposerChrome &&
        cps.hasChosenComposition &&
        cps.saveCompositionError && (
          <Text style={[styles.saveStatus, styles.saveStatusError]}>
            {cps.saveCompositionError}
          </Text>
        )}

      {!hideComposerChrome && cps.hasChosenComposition && (
        <TextInput
          value={cps.title}
          onChangeText={cps.handleTitleChange}
          placeholder="Title"
          placeholderTextColor="#8a91a3"
          style={styles.titleInput}
        />
      )}

      {!hideComposerChrome &&
        cps.hasChosenComposition &&
        cps.transcriptRange && (
          <View style={styles.transcriptRangeRow}>
            <Pressable
              style={[
                styles.segmentArrow,
                !cps.transcriptRange.canGoPrevious &&
                  styles.segmentArrowDisabled,
              ]}
              onPress={() => {
                resetMemorizeRecordingResult();
                cps.transcriptRange?.onPreviousRange();
              }}
              disabled={!cps.transcriptRange.canGoPrevious}
            >
              <Ionicons name="arrow-back" size={17} color="#3d3a52" />
            </Pressable>
            <View style={styles.segmentInputs}>
              <View style={styles.segmentInputGroup}>
                <Text style={styles.segmentInputLabel}>Start</Text>
                <TextInput
                  value={draftSegmentStart}
                  onChangeText={setDraftSegmentStart}
                  onBlur={commitSegmentStart}
                  keyboardType="numeric"
                  style={styles.segmentInput}
                />
              </View>
              <View style={styles.segmentInputGroup}>
                <Text style={styles.segmentInputLabel}>End</Text>
                <TextInput
                  value={draftSegmentEnd}
                  onChangeText={setDraftSegmentEnd}
                  onBlur={commitSegmentEnd}
                  keyboardType="numeric"
                  style={styles.segmentInput}
                />
              </View>
            </View>
            <Pressable
              style={[
                styles.segmentArrow,
                !cps.transcriptRange.canGoNext && styles.segmentArrowDisabled,
              ]}
              onPress={() => {
                resetMemorizeRecordingResult();
                cps.transcriptRange?.onNextRange();
              }}
              disabled={!cps.transcriptRange.canGoNext}
            >
              <Ionicons name="arrow-forward" size={17} color="#3d3a52" />
            </Pressable>
          </View>
        )}

      {isOpeningVideoComposition || cps.isResolvingCurrentComposition ? (
        <View style={styles.openingVideoState}>
          <ActivityIndicator size="small" color="#5a5680" />
          <Text style={styles.openingVideoText}>
            {isOpeningVideoComposition
              ? "Opening video transcript..."
              : "Opening composition..."}
          </Text>
        </View>
      ) : !cps.hasChosenComposition ? (
        <ChooseComposition
          savedCompositions={cps.savedCompositions}
          isLoadingSavedCompositions={cps.isLoadingSavedCompositions}
          savedCompositionError={cps.savedCompositionError}
          isSignedIn={cps.isSignedIn}
          allChannels={allChannels}
          publicSupabase={publicSupabase}
          targetLanguage={targetLanguage}
          targetLanguageVideos={targetLanguageVideos}
          onBlankCanvas={cps.handleBlankCanvas}
          onChooseTemplate={cps.handleChooseTemplate}
          onChooseVideoTranscript={cps.handleChooseVideoTranscript}
          onChooseVideoTranscriptRange={cps.handleChooseVideoTranscriptRange}
          onPreviewVideoMatch={onPreviewVideoMatch}
          onChooseSavedComposition={cps.handleChooseSavedComposition}
          onCopySavedComposition={cps.handleCopySavedComposition}
          onDeleteSavedComposition={cps.handleDeleteSavedComposition}
          onQuickRefreshSavedComposition={onQuickRefreshSavedComposition}
        />
      ) : cps.mode === "write" ? (
        <TextInput
          value={cps.draft}
          onChangeText={cps.handleDraftChange}
          onSelectionChange={(event: any) => {
            const nextSelection = event.nativeEvent.selection;
            if (nextSelection) cps.handleDraftSelectionChange(nextSelection);
          }}
          multiline
          placeholder="Write a short passage... about anything..."
          placeholderTextColor="#8a91a3"
          style={styles.editor}
          textAlignVertical="top"
        />
      ) : (
        <Memorizer
          words={cps.memorizeWords}
          maskedIndices={cps.memorizeMaskedIndices}
          difficulty={cps.memorizeDifficulty}
          onDifficultyChange={cps.setMemorizeDifficultyAndReset}
          onResetRevealedWords={cps.resetRevealedMemorizeWords}
          onRevealWord={cps.revealMemorizeWord}
          onRelayHighlightedWords={handleRelayHighlightedWords}
          highlightedWordsResetKey={cps.highlightedWordsResetKey}
          isFullScreen={isMemorizeFullScreen}
          onToggleFullScreen={onToggleMemorizeFullScreen}
          playbackTime={memorizePlaybackTime}
          playerIsPlaying={memorizePlayerIsPlaying}
          resultsContent={
            isProcessingMemorizeRecording ? (
              <View style={styles.memorizeProcessingContainer}>
                <ActivityIndicator size="large" color="#4ade80" />
                <Text style={styles.memorizeProcessingText}>Analyzing...</Text>
              </View>
            ) : memorizeAccuracyResult ? (
              <ShadowResults
                accuracyResult={memorizeAccuracyResult}
                handleNextSentence={() => {}}
                handleRetry={resetMemorizeRecordingResult}
                retryButtonLabel="Back"
                retryBeforePlayback
                hideNext
                spokenLabel="Spoken: "
                targetLabel="Target: "
                audioUri={memorizeRecordingAudioUri}
              />
            ) : undefined
          }
        />
      )}

      {cps.hasChosenComposition &&
        cps.mode === "memorize" &&
        !isProcessingMemorizeRecording &&
        !memorizeAccuracyResult && (
          <View style={styles.memorizeRecordingPanel}>
            <RecordingControls
              isRecording={isMemorizeRecording}
              onTrash={handleMemorizeRecordingTrashPress}
              onMic={handleMemorizeRecordingMicPress}
              disabled={
                isProcessingMemorizeRecording ||
                hasMemorizeRecordingPermission === false
              }
              showContainer={false}
            />
            {isMemorizeRecording && (
              <Text style={styles.memorizeRecordingCreditText}>
                1 credit per 30 seconds of recording. Credits used:{" "}
                {memorizeRecordingCreditsUsed}
              </Text>
            )}
            {(memorizeRecordingMessage || memorizeRecordingTranscript) && (
              <View style={styles.memorizeRecordingTextGroup}>
                {memorizeRecordingMessage && (
                  <Text style={styles.memorizeRecordingMessage}>
                    {memorizeRecordingMessage}
                  </Text>
                )}
                {memorizeRecordingTranscript && (
                  <Text
                    style={styles.memorizeRecordingTranscript}
                    numberOfLines={2}
                  >
                    {memorizeRecordingTranscript}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

      {cps.hasChosenComposition && (
        <View style={styles.selectionBar}>
          <Ionicons name="scan-outline" size={16} color="#5a5680" />
          <Text style={styles.selectionText} numberOfLines={1}>
            {cps.activeSearchPhrase ||
              "Highlight a word or phrase to hear it spoken"}
          </Text>
        </View>
      )}
      {/* <Modal
        visible={showVideoWriteInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVideoWriteInfo(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowVideoWriteInfo(false)}
        >
          <Pressable style={styles.modalCard}>
            <Ionicons name="information-circle" size={34} color="#3d3a52" />
            <Text style={styles.modalTitle}>Editing Video Text</Text>
            <Text style={styles.modalMessage}>
              You can edit this transcript, but clip matching depends on the
              original video word timings. Edits may stop highlighted text from
              matching the exact clip.
            </Text>
            <Pressable
              style={styles.modalButton}
              onPress={() => setShowVideoWriteInfo(false)}
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal> */}
      <SignInPromptModal
        visible={
          cps.showSaveSignInPrompt ||
          showRecordingSignInPrompt ||
          showWordSignInPrompt
        }
        onClose={() => {
          if (showRecordingSignInPrompt) setShowRecordingSignInPrompt(false);
          if (showWordSignInPrompt) setShowWordSignInPrompt(false);
          if (cps.showSaveSignInPrompt) cps.closeSaveSignInPrompt();
        }}
        onSignIn={() => {
          if (showRecordingSignInPrompt) setShowRecordingSignInPrompt(false);
          if (showWordSignInPrompt) setShowWordSignInPrompt(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  editorPane: {
    flex: 1,
    minHeight: 460,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.14)",
    overflow: "hidden",
  },
  paneHeader: {
    minHeight: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerActions: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  newButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.18)",
  },
  newButtonText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "900",
  },
  modeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    borderRadius: 10,
    backgroundColor: "#e8edf7",
  },
  modeButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: "#3d3a52",
  },
  modeButtonText: {
    color: "#3d3a52",
    fontSize: 13,
    fontWeight: "800",
  },
  modeButtonTextActive: {
    color: "#ffffff",
  },
  saveButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: "#edf4f2",
    borderWidth: 1,
    borderColor: "rgba(38, 112, 93, 0.18)",
  },
  saveButtonMuted: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: "#26705d",
    fontSize: 13,
    fontWeight: "900",
  },
  saveStatus: {
    paddingHorizontal: 14,
    paddingBottom: 6,
    color: "#26705d",
    fontSize: 12,
    fontWeight: "800",
  },
  saveStatusError: {
    color: "#a03a3a",
  },
  titleInput: {
    minHeight: 42,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 105, 189, 0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(74, 105, 189, 0.12)",
    color: "#2f3140",
    fontSize: 17,
    fontWeight: "900",
    outlineStyle: "none" as any,
  },
  transcriptRangeRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(74, 105, 189, 0.12)",
    backgroundColor: "#fbfcff",
  },
  segmentInputs: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  segmentArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.18)",
  },
  segmentArrowDisabled: {
    opacity: 0.32,
  },
  segmentInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  segmentInputLabel: {
    color: "#697187",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  segmentInput: {
    width: 58,
    minHeight: 30,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.18)",
    color: "#2f3140",
    fontSize: 13,
    fontWeight: "900",
    outlineStyle: "none" as any,
  },
  editor: {
    flex: 1,
    minHeight: 380,
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: "#222638",
    fontSize: 20,
    lineHeight: 32,
    outlineStyle: "none" as any,
  },
  openingVideoState: {
    flex: 1,
    minHeight: 380,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  openingVideoText: {
    color: "#697187",
    fontSize: 13,
    fontWeight: "700",
  },
  memorizeRecordingPanel: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderTopColor: "rgba(74, 105, 189, 0.12)",
    backgroundColor: "#ffffff",
  },
  memorizeRecordingTextGroup: {
    width: "100%",
    alignItems: "center",
    gap: 3,
  },
  memorizeRecordingMessage: {
    color: "#697187",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  memorizeRecordingCreditText: {
    color: "#697187",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    textAlign: "center",
    opacity: 0.5,
  },
  memorizeRecordingTranscript: {
    color: "#2f3140",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  memorizeProcessingContainer: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  memorizeProcessingText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },
  selectionBar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 105, 189, 0.12)",
    backgroundColor: "#f7f9ff",
  },
  selectionText: {
    flex: 1,
    color: "#5a5680",
    fontSize: 13,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(16, 21, 34, 0.45)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: 10,
    padding: 22,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  modalTitle: {
    color: "#2f3140",
    fontSize: 18,
    fontWeight: "900",
  },
  modalMessage: {
    color: "#5f687a",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    textAlign: "center",
  },
  modalButton: {
    marginTop: 4,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#3d3a52",
  },
  modalButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
});

export default Composer;
