import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { Channel, Video } from "../../types";
import type { SegmentWord } from "../../types";
import SignInPromptModal from "../common/SignInPromptModal";
import ChooseComposition from "./ChooseComposition";
import Memorizer from "./Memorizer";
import type { CompositionController } from "./useCompositionController";

export type StudioMode = "write" | "memorize";

interface ComposerProps {
  composition: CompositionController;
  isOpeningVideoComposition?: boolean;
  isMemorizeFullScreen?: boolean;
  onToggleMemorizeFullScreen?: () => void;
  onExitMemorizeFullScreen?: () => void;
  allChannels: Channel[];
  publicSupabase: any;
  targetLanguageVideos: Video[];
}

const Composer: React.FC<ComposerProps> = (props) => {
  const {
    composition: cps,
    isOpeningVideoComposition = false,
    isMemorizeFullScreen = false,
    onToggleMemorizeFullScreen,
    onExitMemorizeFullScreen,
    allChannels,
    publicSupabase,
    targetLanguageVideos,
  } = props;
  const [showVideoWriteInfo, setShowVideoWriteInfo] = useState(false);
  const hideComposerChrome = isMemorizeFullScreen && cps.mode === "memorize";

  const handleWriteModePress = () => {
    if (cps.isVideoMode && cps.mode !== "write") {
      setShowVideoWriteInfo(true);
    }
    cps.setMode("write");
  };
  const handleRelayHighlightedWords = useCallback(
    (words: SegmentWord[]) => {
      if (isMemorizeFullScreen && words.length) {
        onExitMemorizeFullScreen?.();
      }
      cps.handleRelayHighlightedWords(words);
    },
    [cps, isMemorizeFullScreen, onExitMemorizeFullScreen],
  );

  useEffect(() => {
    if (isMemorizeFullScreen && cps.mode !== "memorize") {
      onExitMemorizeFullScreen?.();
    }
  }, [cps.mode, isMemorizeFullScreen, onExitMemorizeFullScreen]);

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
                  Write
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeButton,
                  cps.mode === "memorize" && styles.modeButtonActive,
                ]}
                onPress={() => cps.setMode("memorize")}
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
                  onPress={cps.handleNewComposition}
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
              onPress={cps.transcriptRange.onPreviousRange}
              disabled={!cps.transcriptRange.canGoPrevious}
            >
              <Ionicons name="arrow-back" size={17} color="#3d3a52" />
            </Pressable>
            <View style={styles.segmentInputs}>
              <View style={styles.segmentInputGroup}>
                <Text style={styles.segmentInputLabel}>Start</Text>
                <TextInput
                  value={String(cps.transcriptRange.startDisplayIndex)}
                  onChangeText={cps.transcriptRange.onStartSegmentChange}
                  keyboardType="numeric"
                  style={styles.segmentInput}
                />
              </View>
              <View style={styles.segmentInputGroup}>
                <Text style={styles.segmentInputLabel}>End</Text>
                <TextInput
                  value={String(cps.transcriptRange.endDisplayIndex)}
                  onChangeText={cps.transcriptRange.onEndSegmentChange}
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
              onPress={cps.transcriptRange.onNextRange}
              disabled={!cps.transcriptRange.canGoNext}
            >
              <Ionicons name="arrow-forward" size={17} color="#3d3a52" />
            </Pressable>
          </View>
        )}

      {isOpeningVideoComposition ? (
        <View style={styles.openingVideoState}>
          <ActivityIndicator size="small" color="#5a5680" />
          <Text style={styles.openingVideoText}>
            Opening video transcript...
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
          targetLanguageVideos={targetLanguageVideos}
          onBlankCanvas={cps.handleBlankCanvas}
          onChooseTemplate={cps.handleChooseTemplate}
          onChooseVideoTranscript={cps.handleChooseVideoTranscript}
          onChooseSavedComposition={cps.handleChooseSavedComposition}
        />
      ) : cps.mode === "write" ? (
        <TextInput
          value={cps.draft}
          onChangeText={cps.handleDraftChange}
          onSelectionChange={(event: any) => {
            const nextSelection = event.nativeEvent.selection;
            if (nextSelection) cps.setSelection(nextSelection);
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
          onRevealWord={cps.revealMemorizeWord}
          onRelayHighlightedWords={handleRelayHighlightedWords}
          isFullScreen={isMemorizeFullScreen}
          onToggleFullScreen={onToggleMemorizeFullScreen}
        />
      )}

      {cps.hasChosenComposition && (
        <View style={styles.selectionBar}>
          <Ionicons name="scan-outline" size={16} color="#5a5680" />
          <Text style={styles.selectionText} numberOfLines={1}>
            {cps.activeSearchPhrase ||
              "Highlight a phrase to find a matching clip"}
          </Text>
        </View>
      )}
      <Modal
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
      </Modal>
      <SignInPromptModal
        visible={cps.showSaveSignInPrompt}
        onClose={cps.closeSaveSignInPrompt}
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
    minHeight: 38,
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
