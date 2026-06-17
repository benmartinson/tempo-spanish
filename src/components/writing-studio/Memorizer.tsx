import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import DifficultySlider from "../common/DifficultySlider";
import FullSegmentTranscriptBubble from "../common/FullSegmentTranscriptBubble";
import { SegmentWord } from "../../types";
import Editor from "./Editor";

interface MemorizerProps {
  words: SegmentWord[];
  maskedIndices: Set<number>;
  difficulty: number;
  onDifficultyChange: (difficulty: number) => void;
  onResetRevealedWords: () => void;
  onRevealWord: (index: number) => void;
  onRelayHighlightedWords: (words: SegmentWord[]) => boolean | void;
  highlightedWordsResetKey?: number;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  resultsContent?: React.ReactNode;
  playbackTime?: number;
  playerIsPlaying?: boolean;
}

const Memorizer: React.FC<MemorizerProps> = ({
  words,
  maskedIndices,
  difficulty,
  onDifficultyChange,
  onResetRevealedWords,
  onRevealWord,
  onRelayHighlightedWords,
  highlightedWordsResetKey = 0,
  isFullScreen = false,
  onToggleFullScreen,
  resultsContent,
  playbackTime = 0,
  playerIsPlaying = false,
}) => {
  const [completedWords, setCompletedWords] = useState<number[]>([]);

  const handleWordsCompleted = (completed: number[], allComplete: boolean) => {
    setCompletedWords([...completed]);
  };

  return (
    <View style={styles.editorPane}>
      <View style={styles.composerMemorizeContent}>
        {/* {!resultsContent && (
      <View style={styles.controlsRow}>
        <DifficultySlider
          difficulty={difficulty}
          onDifficultyChange={onDifficultyChange}
          onResetRevealedWords={onResetRevealedWords}
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
    )} */}
        <ScrollView
          style={styles.memorizeBubbleScroll}
          contentContainerStyle={styles.memorizeBubbleScrollContent}
          showsVerticalScrollIndicator
        >
          {resultsContent ?? (
            <FullSegmentTranscriptBubble
              words={words}
              blurredIndices={maskedIndices}
              allBlurred={true}
              completedWords={completedWords}
              time={playbackTime}
              playerIsPlaying={playerIsPlaying}
              showFullText
              disableGuessModal={false}
              onWordPress={onRevealWord}
              relayHighlightedWords={onRelayHighlightedWords}
              relayResetKey={highlightedWordsResetKey}
            />
          )}

          <Editor words={words} onWordsComplete={handleWordsCompleted} />
        </ScrollView>
      </View>
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
