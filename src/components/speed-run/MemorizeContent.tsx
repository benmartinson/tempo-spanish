import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, ScrollView } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-expo";
import { RootState, Sentence } from "../../types";
import FullSegmentTranscriptBubble from "../common/FullSegmentTranscriptBubble";
import DifficultySlider from "../common/DifficultySlider";
import { setMemorizeDifficulty } from "../../store/actions/dataActions";
import { persistMemorizeDifficulty } from "../../requests";
import { useSupabaseWithClerk } from "../../../utils/supabase";

interface MemorizeContentProps {
  time: number;
  playKey?: number;
  playerSpeed?: number;
  currentSentence: Sentence;
  playerIsPlaying: boolean;
}

const MemorizeContent: React.FC<MemorizeContentProps> = ({
  time,
  playKey,
  playerSpeed,
  currentSentence,
  playerIsPlaying,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const difficulty = useSelector((state: RootState) => state.memorizeDifficulty);
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const setDifficulty = useCallback((d: number) => {
    dispatch(setMemorizeDifficulty(d));
    persistMemorizeDifficulty({ supabase, userId: userId ?? null, memorizeDifficulty: d });
  }, [dispatch, supabase, userId]);
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

  // Reset revealed words (and difficulty if not saved) on segment change
  useEffect(() => {
    setRevealedWords(new Set());
    if (!userSettings.saveMemorizeDifficulty) {
      setDifficulty(userSettings.defaultMemorizeDifficulty);
    }
  }, [currentSentence.index]);

  return (
    <ScrollView style={styles.container}>
      <FullSegmentTranscriptBubble
        words={currentSentence.words || []}
        blurredIndices={maskedIndices}
        time={time}
        playKey={playKey}
        playerSpeed={playerSpeed}
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
