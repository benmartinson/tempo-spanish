import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { UserComposition } from "../../requests";
import { SegmentWord } from "../../types";
import ChooseComposition, { CompositionTemplate } from "./ChooseComposition";
import Memorizer from "./Memorizer";

export type StudioMode = "write" | "memorize";

interface ComposerProps {
  mode: StudioMode;
  draft: string;
  title: string;
  hasChosenComposition: boolean;
  selectionSearchPhrase: string;
  savedCompositions: UserComposition[];
  isLoadingSavedCompositions: boolean;
  savedCompositionError: string | null;
  isSignedIn: boolean;
  memorizeWords: SegmentWord[];
  memorizeMaskedIndices: Set<number>;
  memorizeDifficulty: number;
  isSavingComposition: boolean;
  saveCompositionError: string | null;
  saveCompositionMessage: string | null;
  onModeChange: (mode: StudioMode) => void;
  onTitleChange: (title: string) => void;
  onDraftChange: (draft: string) => void;
  onSelectionChange: (selection: { start: number; end: number }) => void;
  onBlankCanvas: () => void;
  onChooseTemplate: (template: CompositionTemplate) => void;
  onChooseSavedComposition: (composition: UserComposition) => void;
  onNewComposition: () => void;
  onSaveComposition: () => void;
  onMemorizeDifficultyChange: (difficulty: number) => void;
  onRevealMemorizeWord: (index: number) => void;
  onRelayHighlightedWords: (words: SegmentWord[]) => void;
}

const Composer: React.FC<ComposerProps> = ({
  mode,
  draft,
  title,
  hasChosenComposition,
  selectionSearchPhrase,
  savedCompositions,
  isLoadingSavedCompositions,
  savedCompositionError,
  isSignedIn,
  memorizeWords,
  memorizeMaskedIndices,
  memorizeDifficulty,
  isSavingComposition,
  saveCompositionError,
  saveCompositionMessage,
  onModeChange,
  onTitleChange,
  onDraftChange,
  onSelectionChange,
  onBlankCanvas,
  onChooseTemplate,
  onChooseSavedComposition,
  onNewComposition,
  onSaveComposition,
  onMemorizeDifficultyChange,
  onRevealMemorizeWord,
  onRelayHighlightedWords,
}) => (
  <View style={styles.editorPane}>
    <View style={styles.paneHeader}>
      {hasChosenComposition && (
        <View style={styles.modeSwitch}>
          <Pressable
            style={[
              styles.modeButton,
              mode === "write" && styles.modeButtonActive,
            ]}
            onPress={() => onModeChange("write")}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={mode === "write" ? "#ffffff" : "#3d3a52"}
            />
            <Text
              style={[
                styles.modeButtonText,
                mode === "write" && styles.modeButtonTextActive,
              ]}
            >
              Write
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeButton,
              mode === "memorize" && styles.modeButtonActive,
            ]}
            onPress={() => onModeChange("memorize")}
          >
            <MaterialIcons
              name="psychology"
              size={17}
              color={mode === "memorize" ? "#ffffff" : "#3d3a52"}
            />
            <Text
              style={[
                styles.modeButtonText,
                mode === "memorize" && styles.modeButtonTextActive,
              ]}
            >
              Memorize
            </Text>
          </Pressable>
        </View>
      )}
      <View style={styles.headerActions}>
        {hasChosenComposition && (
          <>
            <Pressable style={styles.newButton} onPress={onNewComposition}>
              <Ionicons name="add" size={16} color="#3d3a52" />
              <Text style={styles.newButtonText}>New</Text>
            </Pressable>
            <Pressable
              style={[
                styles.saveButton,
                (isSavingComposition || !draft.trim()) &&
                  styles.saveButtonMuted,
              ]}
              onPress={onSaveComposition}
              disabled={isSavingComposition || !draft.trim()}
            >
              {isSavingComposition ? (
                <ActivityIndicator size="small" color="#26705d" />
              ) : (
                <Ionicons
                  name={saveCompositionMessage ? "checkmark" : "save-outline"}
                  size={16}
                  color="#26705d"
                />
              )}
              <Text style={styles.saveButtonText}>
                {saveCompositionMessage || "Save"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>

    {hasChosenComposition && saveCompositionError && (
      <Text style={[styles.saveStatus, styles.saveStatusError]}>
        {saveCompositionError}
      </Text>
    )}

    {hasChosenComposition && (
      <TextInput
        value={title}
        onChangeText={onTitleChange}
        placeholder="Title"
        placeholderTextColor="#8a91a3"
        style={styles.titleInput}
      />
    )}

    {!hasChosenComposition ? (
      <ChooseComposition
        savedCompositions={savedCompositions}
        isLoadingSavedCompositions={isLoadingSavedCompositions}
        savedCompositionError={savedCompositionError}
        isSignedIn={isSignedIn}
        onBlankCanvas={onBlankCanvas}
        onChooseTemplate={onChooseTemplate}
        onChooseSavedComposition={onChooseSavedComposition}
      />
    ) : mode === "write" ? (
      <TextInput
        value={draft}
        onChangeText={onDraftChange}
        onSelectionChange={(event: any) => {
          const nextSelection = event.nativeEvent.selection;
          if (nextSelection) onSelectionChange(nextSelection);
        }}
        multiline
        placeholder="Write a short passage... about anything..."
        placeholderTextColor="#8a91a3"
        style={styles.editor}
        textAlignVertical="top"
      />
    ) : (
      <Memorizer
        words={memorizeWords}
        maskedIndices={memorizeMaskedIndices}
        difficulty={memorizeDifficulty}
        onDifficultyChange={onMemorizeDifficultyChange}
        onRevealWord={onRevealMemorizeWord}
        onRelayHighlightedWords={onRelayHighlightedWords}
      />
    )}

    {hasChosenComposition && (
      <View style={styles.selectionBar}>
        <Ionicons name="scan-outline" size={16} color="#5a5680" />
        <Text style={styles.selectionText} numberOfLines={1}>
          {selectionSearchPhrase ||
            "Highlight a phrase to find a matching clip"}
        </Text>
      </View>
    )}
  </View>
);

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
});

export default Composer;
