import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, ScrollView } from "react-native";
import { Sentence } from "../../types";
import FullSegmentTranscriptBubble from "../common/FullSegmentTranscriptBubble";
import DifficultySlider from "../common/DifficultySlider";

interface MemorizeContentProps {
  time: number;
  currentSentence: Sentence;
  playerIsPlaying: boolean;
}

const MemorizeContent: React.FC<MemorizeContentProps> = ({
  time,
  currentSentence,
  playerIsPlaying,
}) => {
  const [difficulty, setDifficulty] = useState(0);
  const [revealedWords, setRevealedWords] = useState<Set<number>>(new Set());

  const maskedIndices = useMemo(() => {
    const masked = new Set<number>();
    if (difficulty === 0 || !currentSentence.words) return masked;
    currentSentence.words.forEach((_, i) => {
      if (revealedWords.has(i)) return;
      switch (difficulty) {
        case 1:
          if ((i + 1) % 3 === 0) masked.add(i);
          break;
        case 2:
          if (i % 2 === 1) masked.add(i);
          break;
        case 3:
          if (i % 3 !== 0) masked.add(i);
          break;
        case 4:
          masked.add(i);
          break;
      }
    });
    return masked;
  }, [currentSentence.words, difficulty, revealedWords]);

  // Reset revealed words on segment change
  useEffect(() => {
    setRevealedWords(new Set());
  }, [currentSentence.index]);

  return (
    <ScrollView style={styles.container}>
      <FullSegmentTranscriptBubble
        words={currentSentence.words || []}
        blurredIndices={maskedIndices}
        time={time}
        playerIsPlaying={playerIsPlaying}
        showFullText
        onWordPress={(index) => {
          setRevealedWords((prev) => {
            const next = new Set(prev);
            next.add(index);
            return next;
          });
        }}
      />

      <DifficultySlider
        difficulty={difficulty}
        onDifficultyChange={(d) => {
          setDifficulty(d);
          setRevealedWords(new Set());
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MemorizeContent;
