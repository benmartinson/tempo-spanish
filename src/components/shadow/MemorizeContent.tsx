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
import { SPANISH_PREPOSITIONS, SPANISH_PRONOUNS } from "../../constants";
import { getAutoHintDifficulty } from "../../helpers/helpers";

interface MemorizeContentProps {
  time: number;
  playKey?: number;
  playerSpeed?: number;
  currentSentence: Sentence;
  playerIsPlaying: boolean;
  isRecording?: boolean;
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
  isRecording = false,
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
  const [manualOverride, setManualOverride] = useState<number | null>(null);

  const baseDifficulty = userSettings.autoSelectDifficulty
    ? getAutoHintDifficulty(
        currentSentence.words?.length ?? 0,
        userSettings.autoSelectDifficultyLevel,
      )
    : userSettings.saveMemorizeDifficulty
      ? savedDifficulty
      : localDifficulty;

  const difficulty = manualOverride ?? baseDifficulty;

  const setDifficulty = useCallback(
    (d: number) => {
      if (userSettings.autoSelectDifficulty) {
        setManualOverride(d);
      } else if (userSettings.saveMemorizeDifficulty) {
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
      userSettings.autoSelectDifficulty,
      onLocalDifficultyChange,
    ],
  );
  const [revealedWords, setRevealedWords] = useState<Set<number>>(new Set());
  const [hintLevels, setHintLevels] = useState<Record<number, number>>({});

  // Compute which words would be masked (ignoring reveals) — stable per difficulty/segment
  const baseMaskedIndices = useMemo(() => {
    const masked = new Set<number>();
    if (difficulty === 0 || !currentSentence.words) return masked;
    if (difficulty === 4) {
      currentSentence.words.forEach((_, i) => masked.add(i));
      return masked;
    }
    const easyWords = new Set([...SPANISH_PREPOSITIONS, ...SPANISH_PRONOUNS]);
    const easyIndices: number[] = [];
    const restIndices: number[] = [];
    currentSentence.words.forEach((word, i) => {
      const normalized = word.word
        .trim()
        .toLowerCase()
        .replace(/[,.!?]$/, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (easyWords.has(normalized)) {
        easyIndices.push(i);
      } else {
        restIndices.push(i);
      }
    });
    // Case 1: only easy words, but skip if previous two are already masked.
    easyIndices.forEach((i) => {
      if (difficulty === 1 && masked.has(i - 1) && masked.has(i - 2)) return;
      masked.add(i);
    });
    if (difficulty >= 2) {
      const available = easyIndices.length + restIndices.length;
      const targetPct = difficulty === 2 ? 0.55 : 0.75;
      const targetCount = Math.round(available * targetPct);
      const additionalNeeded = Math.max(0, targetCount - easyIndices.length);
      const count = Math.min(additionalNeeded, restIndices.length);
      for (let j = 0; j < count; j++) {
        const idx = Math.floor((j * restIndices.length) / count);
        masked.add(restIndices[idx]);
      }
    }
    return masked;
  }, [currentSentence.words, difficulty]);

  // Subtract revealed words — doesn't shift which other words are masked
  const maskedIndices = useMemo(() => {
    if (revealedWords.size === 0) return baseMaskedIndices;
    const masked = new Set(baseMaskedIndices);
    revealedWords.forEach((i) => masked.delete(i));
    return masked;
  }, [baseMaskedIndices, revealedWords]);

  // How many characters to reveal per hint level
  const revealCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const [indexStr, level] of Object.entries(hintLevels)) {
      const index = Number(indexStr);
      if (level === 1) counts[index] = 1;
    }
    return counts;
  }, [hintLevels, currentSentence.index, difficulty]);

  // Reset revealed words and manual override on segment change or recording toggle
  useEffect(() => {
    setRevealedWords(new Set());
    setHintLevels({});
    setManualOverride(null);
  }, [currentSentence.index]);

  useEffect(() => {
    setRevealedWords(new Set());
    setHintLevels({});
  }, [isRecording]);

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
        disableGuessModal={isRecording}
        playWordSnippet={playWordSnippet}
        revealCounts={revealCounts}
        onWordPress={(index) => {
          if (isRecording) {
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
