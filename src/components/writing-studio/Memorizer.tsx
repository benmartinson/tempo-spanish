import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
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
}

const Memorizer: React.FC<MemorizerProps> = ({
  words,
  maskedIndices,
  difficulty,
  onDifficultyChange,
  onRevealWord,
  onRelayHighlightedWords,
}) => (
  <View style={styles.composerMemorizeContent}>
    <DifficultySlider
      difficulty={difficulty}
      onDifficultyChange={onDifficultyChange}
      variant="compact"
      style={styles.composerDifficultySlider}
    />
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
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  composerDifficultySlider: {
    alignSelf: "stretch",
    marginTop: 12,
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
