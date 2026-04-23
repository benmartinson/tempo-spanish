import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { RootState, SegmentWord, VocabCacheEntry } from "../../types";
import { useSelector } from "react-redux";
import {
  removeSpecialPunctuation,
  addEllipsis,
  stripPunctuation,
  stripDiacritics,
  computeMatchedTimedWords,
} from "../../helpers/helpers";
import { useInterpolatedTime } from "../../hooks/useInterpolatedTime";
import { useStableChunkIdx } from "../../hooks/useStableChunkIdx";
import { fetchVocabTranslation } from "../../requests";
import { COMMON_WORD_TRANSLATIONS } from "../../constants";

// Flatten hardcoded translations into VocabCacheEntry[] (one per translation)
// so that all translations participate in the lookup.
const HARDCODED_CACHE_ENTRIES: VocabCacheEntry[] =
  COMMON_WORD_TRANSLATIONS.flatMap((c) =>
    c.translations.map((t) => ({
      word: c.word,
      translation: t,
      alternateMeanings: [],
    })),
  );

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
};

interface TranslateContentProps {
  translationText: string | null;
  sentenceText?: string;
  sentenceWords?: SegmentWord[];
  isLoading: boolean;
  time?: number;
  playerIsPlaying?: boolean;
  segmentStart?: number;
  segmentEnd?: number;
  playKey?: number;
  playerSpeed?: number;
  isRecording?: boolean;
  vocabCache?: VocabCacheEntry[];
  onVocabCacheUpdate?: (entry: VocabCacheEntry) => void;
  vocabCacheHydrating?: boolean;
}

const normalize = (w: string) =>
  stripDiacritics(stripPunctuation(w.trim().toLowerCase()));

const TranslateContent: React.FC<TranslateContentProps> = ({
  translationText,
  sentenceText,
  sentenceWords,
  isLoading,
  time = 0,
  playerIsPlaying = false,
  segmentStart = 0,
  segmentEnd = 0,
  playKey,
  playerSpeed = 1,
  isRecording = false,
  vocabCache,
  onVocabCacheUpdate,
  vocabCacheHydrating = false,
}) => {
  const userSettings = useSelector((state: RootState) => state.userSettings);
  const localTime = useInterpolatedTime(
    time,
    playerIsPlaying,
    playKey,
    playerSpeed,
  );

  const displayText = translationText
    ? addEllipsis(removeSpecialPunctuation(translationText), sentenceText)
    : "";

  const words = useMemo(
    () => displayText.split(/\s+/).filter(Boolean),
    [displayText],
  );

  // All unique Spanish words in the sentence (hardcoded cache + DB cache supply
  // translations for common/skippable ones; anything left gets fetched)
  const wordsToTranslate = useMemo(() => {
    if (!sentenceWords?.length) return [];
    const seen = new Set<string>();
    const result: SegmentWord[] = [];
    for (const w of sentenceWords) {
      const normalized = normalize(w.word);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(w);
    }
    return result;
  }, [sentenceWords]);

  // Effective cache mergeds DB entries with common hardcoded translations.
  // Hardcoded entries cover prepositions/pronouns that we don't want to fetch.
  const effectiveCache = useMemo(
    () => [...(vocabCache ?? []), ...HARDCODED_CACHE_ENTRIES],
    [vocabCache],
  );

  // Fetch translations for all content words in parallel
  const [isFetchingTranslations, setIsFetchingTranslations] = useState(false);
  const [fetchTick, setFetchTick] = useState(0);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    if (
      !wordsToTranslate.length ||
      !onVocabCacheUpdate ||
      !translationText ||
      isLoading ||
      vocabCacheHydrating
    ) {
      setIsFetchingTranslations(false);
      return;
    }

    const missing = wordsToTranslate.filter(
      (w) =>
        !effectiveCache.some((c) => normalize(c.word) === normalize(w.word)),
    );
    if (!missing.length) {
      setIsFetchingTranslations(false);
      return;
    }

    setIsFetchingTranslations(true);
    (async () => {
      for (const w of missing) {
        if (cancelRef.current) return;
        try {
          const result = await fetchVocabTranslation({
            vocabWord: w.word,
            sentenceText: sentenceText ?? "",
            sentenceTranslation: translationText ?? null,
          });
          if (cancelRef.current) return;
          if (result.translation) {
            onVocabCacheUpdate({
              word: w.word,
              translation: result.translation,
              alternateMeanings: result.alternateMeanings,
            });
          }
        } catch (err: any) {
          console.error(
            `Error fetching vocab translation for "${w.word}":`,
            err?.message ?? err,
            err,
          );
        }
      }
    })().finally(() => {
      if (!cancelRef.current) {
        setIsFetchingTranslations(false);
        setFetchTick((t) => t + 1);
      }
    });

    return () => {
      cancelRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wordsToTranslate,
    sentenceText,
    translationText,
    onVocabCacheUpdate,
    isLoading,
    vocabCacheHydrating,
    effectiveCache,
  ]);

  // Build matched timedWords from Spanish word timings + vocab translations.
  // Falls back to uniform distribution while fetching or when data is unavailable.
  const timedWords = useMemo(() => {
    const duration = segmentEnd - segmentStart;
    if (!words.length || duration <= 0) return [];

    const uniform = () => {
      const timePerWord = duration / words.length;
      return words.map((w, i) => ({
        word: w,
        start: segmentStart + i * timePerWord,
        end: segmentStart + (i + 1) * timePerWord,
      }));
    };

    if (isFetchingTranslations || !wordsToTranslate.length) {
      return uniform();
    }

    const matched = computeMatchedTimedWords({
      words,
      wordsToTranslate,
      vocabCache: effectiveCache,
      segmentStart,
      segmentEnd,
    });
    return matched ?? uniform();
    // fetchTick triggers recomputation once cache is populated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    words,
    segmentStart,
    segmentEnd,
    wordsToTranslate,
    effectiveCache,
    isFetchingTranslations,
    fetchTick,
  ]);

  const { activeChunkStart, activeChunkEnd } = useStableChunkIdx({
    words: timedWords,
    time: localTime,
    isReplay: localTime <= segmentStart + 0.5,
    resetKey: `${segmentStart}-${segmentEnd}-${words.length}`,
    inactive: !playerIsPlaying,
  });

  // useEffect(() => {
  //   console.log({ activeChunkStart, activeChunkEnd, localTime });
  // }, [activeChunkStart]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4a69bd" />
        <Text style={styles.loadingText}>Loading translation...</Text>
      </View>
    );
  }

  if (!translationText) return null;

  return (
    <View>
      <View style={styles.questionBubble}>
        <Text style={styles.questionText}>
          {words.map((word, index) => {
            const isActive =
              activeChunkStart >= 0 &&
              index >= activeChunkStart &&
              index <= activeChunkEnd;
            return (
              <Text
                key={index}
                style={isActive ? styles.activeWord : undefined}
              >
                {index > 0 ? " " : ""}
                {word}
              </Text>
            );
          })}
        </Text>
      </View>
      {isFetchingTranslations && (
        <View style={styles.adjustingRow}>
          <ActivityIndicator size="small" color="#888" />
          <Text style={styles.adjustingText}>Adjusting for translations…</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  questionBubble: {
    backgroundColor: "#f0f4ff",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 16,
    marginBottom: 12,
    alignSelf: "flex-start" as const,
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4a69bd",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  questionText: {
    fontSize: 17,
    lineHeight: 24,
    color: "#222",
  },
  activeWord: {
    color: "#4CAF50",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
  },
  adjustingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  adjustingText: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
  },
});

export default TranslateContent;
