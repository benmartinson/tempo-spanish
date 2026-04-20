import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, ScrollView } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-expo";
import { RootState, Sentence, SegmentWord } from "../../types";
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
  disableGuessModal?: boolean;
  localDifficulty: number;
  onLocalDifficultyChange: (d: number) => void;
  playWordSnippet?: (word: SegmentWord, isSlow?: boolean) => void;
}

const MemorizeContent: React.FC<MemorizeContentProps> = ({
  time,
  playKey,
  playerSpeed,
  currentSentence,
  playerIsPlaying,
  disableGuessModal = false,
  localDifficulty,
  onLocalDifficultyChange,
  playWordSnippet,
}) => {
  const dispatch = useDispatch();
  const supabase = useSupabaseWithClerk();
  const { userId } = useAuth();
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const savedDifficulty = useSelector(
    (state: RootState) => state.memorizeDifficulty,
  );
  const difficulty = userSettings.saveMemorizeDifficulty
    ? savedDifficulty
    : localDifficulty;
  const setDifficulty = useCallback(
    (d: number) => {
      if (userSettings.saveMemorizeDifficulty) {
        dispatch(setMemorizeDifficulty(d));
        persistMemorizeDifficulty({
          supabase,
          userId: userId ?? null,
          memorizeDifficulty: d,
        });
      } else {
        onLocalDifficultyChange(d);
      }
    },
    [
      dispatch,
      supabase,
      userId,
      userSettings.saveMemorizeDifficulty,
      onLocalDifficultyChange,
    ],
  );
  const [revealedWords, setRevealedWords] = useState<Set<number>>(new Set());
  const [hintLevels, setHintLevels] = useState<Record<number, number>>({});

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

  // How many characters to reveal per hint level
  const revealCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const [indexStr, level] of Object.entries(hintLevels)) {
      const index = Number(indexStr);
      if (level === 1) counts[index] = 1;
    }
    return counts;
  }, [hintLevels, currentSentence.index, difficulty]);

  // Reset revealed words on segment change or recording toggle
  useEffect(() => {
    setRevealedWords(new Set());
    setHintLevels({});
  }, [currentSentence.index, disableGuessModal]);

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
        disableGuessModal={disableGuessModal}
        playWordSnippet={playWordSnippet}
        revealCounts={revealCounts}
        onWordPress={(index) => {
          if (disableGuessModal) {
            // During recording: progressive hint reveal
            const currentLevel = hintLevels[index] ?? 0;
            const wordText = currentSentence.words?.[index]?.word?.trim() ?? "";
            const skipHint = /^\d/.test(wordText) || wordText.length <= 1;
            if (currentLevel === 0 && !skipHint) {
              setHintLevels((prev) => ({ ...prev, [index]: 1 }));
            } else {
              setRevealedWords((prev) => {
                const next = new Set(prev);
                next.add(index);
                return next;
              });
            }
          } else {
            setRevealedWords((prev) => {
              const next = new Set(prev);
              next.add(index);
              return next;
            });
          }
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
