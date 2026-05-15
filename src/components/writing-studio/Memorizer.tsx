import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import DifficultySlider from "../common/DifficultySlider";
import FullSegmentTranscriptBubble from "../common/FullSegmentTranscriptBubble";
import { SegmentWord } from "../../types";

interface MemorizerProps {
  words: SegmentWord[];
  maskedIndices: Set<number>;
  difficulty: number;
  onDifficultyChange: (difficulty: number) => void;
  onRevealWord: (index: number) => void;
  onRelayHighlightedWords: (words: SegmentWord[]) => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

const Memorizer: React.FC<MemorizerProps> = ({
  words,
  maskedIndices,
  difficulty,
  onDifficultyChange,
  onRevealWord,
  onRelayHighlightedWords,
  isFullScreen = false,
  onToggleFullScreen,
}) => (
  <View style={styles.composerMemorizeContent}>
    <View style={styles.controlsRow}>
      <DifficultySlider
        difficulty={difficulty}
        onDifficultyChange={onDifficultyChange}
        variant="compact"
        style={styles.composerDifficultySlider}
      />
      <Pressable
        style={styles.fullScreenButton}
        onPress={onToggleFullScreen}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialIcons
          name={isFullScreen ? "fullscreen-exit" : "fullscreen"}
          size={20}
          color="#3d3a52"
        />
      </Pressable>
    </View>
    <ScrollView
      style={styles.memorizeBubbleScroll}
      contentContainerStyle={styles.memorizeBubbleScrollContent}
      showsVerticalScrollIndicator
    >
      <FullSegmentTranscriptBubble
        words={words}
        blurredIndices={maskedIndices}
        time={0}
        playerIsPlaying={false}
        showFullText
        disableGuessModal={false}
        onWordPress={onRevealWord}
        relayHighlightedWords={onRelayHighlightedWords}
      />
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  composerMemorizeContent: {
    flex: 1,
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  controlsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  composerDifficultySlider: {
    flex: 1,
    alignSelf: "auto",
  },
  fullScreenButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(74, 105, 189, 0.18)",
  },
  memorizeBubbleScroll: {
    flex: 1,
    marginTop: 12,
    minHeight: 0,
  },
  memorizeBubbleScrollContent: {
    paddingBottom: 8,
  },
});

export default Memorizer;
