import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SegmentWord } from "../../types";
import Memorizer from "./Memorizer";

export type StudioMode = "write" | "memorize";

interface ComposerProps {
  mode: StudioMode;
  draft: string;
  selectionSearchPhrase: string;
  memorizeWords: SegmentWord[];
  memorizeMaskedIndices: Set<number>;
  memorizeDifficulty: number;
  onModeChange: (mode: StudioMode) => void;
  onDraftChange: (draft: string) => void;
  onSelectionChange: (selection: { start: number; end: number }) => void;
  onMemorizeDifficultyChange: (difficulty: number) => void;
  onRevealMemorizeWord: (index: number) => void;
  onRelayHighlightedWords: (words: SegmentWord[]) => void;
}

const Composer: React.FC<ComposerProps> = ({
  mode,
  draft,
  selectionSearchPhrase,
  memorizeWords,
  memorizeMaskedIndices,
  memorizeDifficulty,
  onModeChange,
  onDraftChange,
  onSelectionChange,
  onMemorizeDifficultyChange,
  onRevealMemorizeWord,
  onRelayHighlightedWords,
}) => (
  <View style={styles.editorPane}>
    <View style={styles.paneHeader}>
      <Text style={styles.paneTitle}>Composer</Text>
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
    </View>

    {mode === "write" ? (
      <TextInput
        value={draft}
        onChangeText={onDraftChange}
        onSelectionChange={(event: any) => {
          const nextSelection = event.nativeEvent.selection;
          if (nextSelection) onSelectionChange(nextSelection);
        }}
        multiline
        placeholder="Write a short passage..."
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

    <View style={styles.selectionBar}>
      <Ionicons name="scan-outline" size={16} color="#5a5680" />
      <Text style={styles.selectionText} numberOfLines={1}>
        {selectionSearchPhrase || "Highlight a phrase to find a matching clip"}
      </Text>
    </View>
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
  paneTitle: {
    color: "#2f3140",
    fontSize: 16,
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
