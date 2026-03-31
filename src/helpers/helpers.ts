import {
  Segment,
  Sentence,
  SegmentWord,
  VideoContext,
  Vocabulary,
  ContextSegment,
  AccuracyResult,
} from "../types";
import { levenshtein } from "./calculate_accuracy";

export const formatTimestamp = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const cachedResponses = [
  "You got 100% correct!",
  "You got 99% correct!",
  "You got 98% correct!",
  "You got 97% correct!",
  "You got 96% correct!",
  "You got 95% correct!",
  "You got 94% correct!",
  "You got 93% correct!",
  "You got 92% correct!",
  "You got 91% correct!",
  "You got 90% correct!",
  "You got above 80 percent correct!",
  "You got above 70 percent correct!",
  "You got less than 70 percent correct",
  "You got less than 60 percent correct",
  "You got less than 50 percent correct",
  "You got less than 40 percent correct",
  "You got less than 30 percent correct",
  "You got less than 20 percent correct",
  "You got less than 10 percent correct",
  "You missed the word",
  "and,",
  "Review unavailable for scores less than 70%",
  "You said",
  "instead of",
  "Fetching...",
];

export const getResponseForPercentage = (percentage: number): string => {
  if (percentage >= 90) return `You got ${Math.round(percentage)}% correct!`;
  if (percentage >= 80) return "You got above 80 percent correct!";
  if (percentage >= 70) return "You got above 70 percent correct!";
  if (percentage >= 60) return "You got less than 70 percent correct";
  if (percentage >= 50) return "You got less than 60 percent correct";
  if (percentage >= 40) return "You got less than 50 percent correct";
  if (percentage >= 30) return "You got less than 40 percent correct";
  if (percentage >= 20) return "You got less than 30 percent correct";
  if (percentage >= 10) return "You got less than 20 percent correct";
  return "You got less than 10 percent correct";
};

export const ignoreVocab = [
  "por",
  "la",
  "los",
  "las",
  "el",
  "un",
  "una",
  "unos",
  "unas",
  "familia",
  "de",
  "se",
  "y",
  "en",
  "con",
  "quien",
  "como",
  "sin",
  "al",
  "del",
  "a",
  "no",
  "les",
  "le",
  "lo",
  "que",
  "es",
  "si",
  "su",
  "uno",
  "o",
  "esta",
  "está",
  "esto",
  "estos",
  "estas",
  "esté",
  "este",
  "todo",
  "todos",
];

export const addEllipsis = (text: string) => {
  return text.endsWith(",") ? text.slice(0, -1) + "..." : text;
};

export const capitalize = (word: string) => {
  return word.charAt(0).toUpperCase() + word.slice(1);
};

export const stripDiacritics = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const stripPunctuation = (word: string) => {
  return word.replace(/[.,\/#!$%\^&\*\?;:{}=\-\"\'_`~()]/g, "");
};

export const normalizeWord = (word: string) =>
  capitalize(stripPunctuation(word.trim().toLowerCase()));

export const randomlySelectVocabFromVocabulary = (
  vocab: Vocabulary[],
  count: number,
  alreadySelectedVocab: string[],
): Vocabulary[] => {
  const normalizedAlready = new Set(alreadySelectedVocab.map(normalizeWord));
  const filtered = vocab.filter(
    (v) =>
      !ignoreVocab.some((i) => i.toLowerCase() === v.word.toLowerCase()) &&
      v.translation !== v.word &&
      !normalizedAlready.has(normalizeWord(v.word)),
  );
  const byWord = new Map<string, Vocabulary>();
  for (const v of filtered) {
    const key = normalizeWord(v.word);
    if (!byWord.has(key)) byWord.set(capitalize(key), v);
  }
  return Array.from(byWord.values())
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
};

// Helper function to split words into sentences based on punctuation
export const splitIntoSentences = (words: SegmentWord[]): SegmentWord[][] => {
  const sentences: SegmentWord[][] = [];
  let currentSentenceWords: SegmentWord[] = [];
  for (const word of words) {
    word.word = word.word.trim();
    currentSentenceWords.push(word);
    // Check if word ends with sentence-ending punctuation
    if (/[.!?]$/.test(word.word)) {
      sentences.push(currentSentenceWords);
      currentSentenceWords = [];
    }
  }
  // Handle remaining words (last sentence without punctuation)
  if (currentSentenceWords.length > 0) {
    sentences.push(currentSentenceWords);
  }
  return sentences;
};

export const splitTranslationIntoSentences = (
  translation: string,
): string[] => {
  return translation.split(/[.!?]/).map((s) => s.trim());
};

export const splitSegmentsIntoSentences = (segments: Segment[]): Sentence[] => {
  const allSentences: Sentence[] = [];
  let sentenceIndex = 0;
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const segment = segments[segmentIndex];
    const sentenceWordGroups = splitIntoSentences(segment.words);
    for (let i = 0; i < sentenceWordGroups.length; i++) {
      const words = sentenceWordGroups[i];
      if (words.length === 0) continue;

      const text = words.map((w) => w.word).join(" ");
      const start = words[0].start;
      const end = words[words.length - 1].end;

      allSentences.push({
        index: sentenceIndex,
        start,
        end,
        text,
        words,
      });
      sentenceIndex++;
    }
  }

  return allSentences;
};

export interface SegmentSeekResult {
  segmentIndex: number;
  sentenceIndex: number;
}

/**
 * Finds the segment and sentence that contain the given time.
 * Returns null if the time doesn't fall within any segment
 * or if it's already in the given currentSegmentIndex.
 */
export const findSegmentAndSentenceByTime = (
  time: number,
  segments: Segment[],
  currentSegmentIndex: number,
): SegmentSeekResult | null => {
  const targetIndex =
    time < 1
      ? 0
      : segments.findIndex((seg) => time >= seg.start && time <= seg.end);

  if (targetIndex < 0 || targetIndex === currentSegmentIndex) {
    return null;
  }

  const targetSegment = segments[targetIndex];
  const targetSentences = splitIntoSentences(targetSegment.words);
  let sentenceIndex = 0;
  for (let i = 0; i < targetSentences.length; i++) {
    const words = targetSentences[i];
    const sStart = words[0]?.start ?? 0;
    const sEnd = words[words.length - 1]?.end ?? 0;
    if (time >= sStart && time <= sEnd) {
      sentenceIndex = i;
      break;
    }
  }

  return { segmentIndex: targetIndex, sentenceIndex };
};

export const findSentenceWithVocab = (
  segment: Segment,
  wordTime: number,
): number => {
  const sentences = splitIntoSentences(segment.words);
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if (
      sentence.some((w) => w.start <= wordTime) &&
      sentence.some((w) => w.end >= wordTime)
    ) {
      return i;
    }
  }
  return null;
};

export const vocabFormatWord = (word: string) => {
  return stripPunctuation(word.toLowerCase()).trim();
};

export const autoSelectVocabForVideo = (
  allWords: SegmentWord[],
  allVocabulary: Record<string, Vocabulary>,
  userKnownVocab: number[],
): SegmentWord[] => {
  const allSentences = splitIntoSentences(allWords);
  const selectedVocab = [];
  const minimumInterval = 7;
  let latestTime = 0;
  for (const sentence of allSentences) {
    const lowestFrequencyWord = sentence
      .filter((w) => {
        const normalizedWord = vocabFormatWord(w.word);
        const vocabulary = allVocabulary[normalizedWord];
        if (!vocabulary) return false;
        const normalizedTranslation = stripPunctuation(
          vocabulary.translation.toLowerCase(),
        );

        return (
          (latestTime === 0 || w.start > latestTime + minimumInterval) &&
          isInterestingVocab(vocabulary) &&
          !userKnownVocab.includes(vocabulary.id)
        );
      })
      .reduce(
        (min, word) => {
          const normalizedWord = stripPunctuation(
            word.word.toLowerCase(),
          ).trim();
          const vocabulary = allVocabulary[normalizedWord];
          const frequency = vocabulary?.frequency;
          if (frequency && frequency < min.frequency) {
            latestTime = word.start;
            return {
              ...word,
              translation: normalizeWord(vocabulary.translation),
              word: normalizeWord(word.word),
              frequency,
            };
          }
          return min;
        },
        { frequency: Infinity },
      );
    if (lowestFrequencyWord.frequency < Infinity) {
      selectedVocab.push(lowestFrequencyWord);
    }
  }
  return selectedVocab;
};

export const createVocabHash = (
  vocab: Vocabulary[],
): Record<string, Vocabulary> => {
  const vocabSortedByFrequency = vocab
    .filter((v) => !ignoreVocab.includes(v.word.toLowerCase()))
    .sort((a, b) => b.frequency - a.frequency);
  const totalWords = vocabSortedByFrequency.length;

  let index = 0;
  return vocabSortedByFrequency.reduce(
    (acc, v) => {
      let percentile = Math.round((index / totalWords) * 100);
      if (percentile === 0) {
        percentile = 1;
      }

      v.percentile = percentile;
      acc[v.word] = v;
      index++;
      return acc;
    },
    {} as Record<string, Vocabulary>,
  );
};

export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^\w\s]/g, "") // punctuation
    .trim();

/**
 * Calculate similarity between two strings (0-1)
 */
function similarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

/**
 * Check if two words are similar enough to be considered a match
 */
function wordMatches(spoken: string, target: string, threshold = 0.7): boolean {
  const normalizedSpoken = normalize(spoken);
  const normalizedTarget = normalize(target);

  // Exact match
  if (normalizedSpoken === normalizedTarget) return true;

  // Partial match (one contains the other)
  if (
    normalizedSpoken.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedSpoken)
  ) {
    return true;
  }

  // Fuzzy match using similarity
  return similarity(normalizedSpoken, normalizedTarget) >= threshold;
}

export const getNextHintText = (
  details: {
    targetWord: string;
    matched: boolean;
    _matchScore?: number;
  }[],
): string | null => {
  let lastMatchedIndex = -1;
  for (let i = details.length - 1; i >= 0; i--) {
    if (details[i].matched && (details[i]._matchScore ?? 0) > 0) {
      lastMatchedIndex = i;
      break;
    }
  }

  const remaining = details.slice(lastMatchedIndex + 1);
  if (remaining.length === 0) return null;

  const firstWord = remaining[0].targetWord;
  return firstWord.length > 5 || remaining.length === 1
    ? firstWord
    : `${firstWord} ${remaining[1].targetWord}`;
};

export const findClosestWord = (
  spoken: string,
  words: SegmentWord[],
): SegmentWord => {
  const spokenLower = spoken.toLowerCase();

  let bestMatch = words[0];
  let bestDistance = Infinity;

  for (const hw of words) {
    const candidate = stripPunctuation(hw.word.toLowerCase());

    if (candidate === spokenLower) return hw;

    const distance = levenshtein(spokenLower, candidate);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = hw;
    }
  }

  return bestMatch;
};

export const areWordsSimilar = (word1: string, word2: string) => {
  let diffCount = 0;
  for (let i = 0; i < word1.length; i++) {
    if (i >= word2.length) diffCount++;
    else if (word1[i] !== word2[i]) diffCount++;
  }
  diffCount += Math.abs(word2.length - word1.length);
  return diffCount <= 2;
};

export const isInterestingVocab = (vocab: Vocabulary) => {
  // const normalizedWord = stripPunctuation(vocab.word.toLowerCase()).trim();
  // const normalizedTranslation = stripPunctuation(
  //   vocab.translation.toLowerCase(),
  // );

  return (
    vocab.word.length > 3 &&
    // !areWordsSimilar(normalizedWord, normalizedTranslation) &&
    !ignoreVocab.includes(vocab.word.toLowerCase())
  );
};

// Score display constants for review evaluations
export type VocabEvaluationScore = "correct" | "incorrect";

export const VOCAB_SCORE_COLORS: Record<VocabEvaluationScore, string> = {
  correct: "#2d8a4e",
  incorrect: "#c0392b",
};

export const VOCAB_SCORE_BG_COLORS: Record<VocabEvaluationScore, string> = {
  correct: "#e8f5e9",
  incorrect: "#ffebee",
};

export const VOCAB_SCORE_LABELS: Record<VocabEvaluationScore, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
};

export const getRandomUniqueIndex = (
  maxLength: number,
  previousIndexes: number[],
  maxAttempts: number = 100,
): number => {
  let newIndex = Math.floor(Math.random() * maxLength);
  let count = 0;
  while (previousIndexes.includes(newIndex) && count < maxAttempts) {
    newIndex = Math.floor(Math.random() * maxLength);
    count++;
  }
  return newIndex;
};

export const findMatchingSentencesForVocab = (
  vocabWord: string,
  sentences: Sentence[],
): ContextSegment[] => {
  const matchingSentences: ContextSegment[] = [];
  for (let sentIndex = 0; sentIndex < sentences.length; sentIndex++) {
    const sentenceWords = sentences[sentIndex].text
      .split(" ")
      .map((s) => normalizeWord(s));
    if (sentenceWords.includes(normalizeWord(vocabWord))) {
      matchingSentences.push({
        segment_id: sentIndex,
        start: sentences[sentIndex].start,
        end: sentences[sentIndex].end,
        text: sentences[sentIndex].text,
        score: 1,
      });
    }
  }
  return matchingSentences;
};

export interface VocabItem {
  word: string;
  id: number;
  translation: string;
  contextSegments: ContextSegment[];
}

export const buildVocabItemsWithContext = (
  vocabWords: Vocabulary[],
  sentences: Sentence[],
): VocabItem[] => {
  return vocabWords.map((vocab) => {
    const matchingSentences = findMatchingSentencesForVocab(
      vocab.word,
      sentences,
    );
    return {
      word: vocab.word,
      id: vocab.id,
      translation: vocab.translation,
      contextSegments: matchingSentences,
    };
  });
};

export const getUncommonVocabFromSentences = (
  sentences: Sentence[],
  allVocabulary: Record<string, Vocabulary>,
  limit: number = 50,
): Vocabulary[] => {
  const seenKeys = new Set<string>();
  const videoVocab: Vocabulary[] = [];

  sentences.forEach((sentence) => {
    sentence.words.forEach((segWord) => {
      const key = vocabFormatWord(segWord.word);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const vocab = allVocabulary[key];
        if (vocab) {
          videoVocab.push(vocab);
        }
      }
    });
  });

  return [...videoVocab]
    .filter((vocab) => isInterestingVocab(vocab))
    .sort((a, b) => a.frequency - b.frequency)
    .slice(0, limit);
};

export const getFocusVocabWords = (
  focusVocabIds: number[],
  allVocabulary: Record<string, Vocabulary>,
): Vocabulary[] => {
  return focusVocabIds
    .map((id) => Object.values(allVocabulary).find((v) => v.id === id))
    .filter((vocab): vocab is Vocabulary => {
      if (!vocab) {
        console.error(`Vocabulary not found for word id`);
        return false;
      }
      return true;
    });
};

export const selectGuidedVocab = (
  allVocabulary: Record<string, Vocabulary>,
  userKnownVocab: number[],
  focusVocabIds: number[],
  percentileRange: [number, number] | null,
  count: number = 8,
  excludeIds: number[] = [],
): Vocabulary[] => {
  const knownSet = new Set(userKnownVocab);
  const excludeSet = new Set(excludeIds);
  const allWords = Object.values(allVocabulary).filter(
    (v) => !knownSet.has(v.id) && !excludeSet.has(v.id),
  );

  const [minP, maxP] = percentileRange ?? [1, 20];

  // Pick up to 2 from focus vocab that are not known
  const focusWords = focusVocabIds
    .map((id) => allWords.find((v) => v.id === id))
    .filter((v): v is Vocabulary => !!v)
    .slice(0, 2);

  const focusIds = new Set(focusWords.map((v) => v.id));

  // Fill remaining from percentile range
  const poolWords = allWords
    .filter(
      (v) =>
        normalizeWord(v.translation) !== normalizeWord(v.word) &&
        !focusIds.has(v.id) &&
        v.percentile >= minP &&
        v.percentile <= maxP,
    )
    .sort(() => Math.random() - 0.5);

  const remaining = count - focusWords.length;
  return [...focusWords, ...poolWords.slice(0, remaining)];
};

export const removeSpecialPunctuation = (text: string) => {
  return text
    .split(" ")
    .map((word) => {
      if (word.endsWith("...,") || word.endsWith(",...")) {
        return word.slice(0, -4);
      }
      if (word.startsWith("...")) {
        return word.slice(3);
      }
      if (word.endsWith("...")) {
        return word.slice(0, -3);
      }
      if (
        word.endsWith(".,") ||
        word.endsWith(",.") ||
        word.endsWith("!,") ||
        word.endsWith("?,")
      ) {
        return word.slice(0, -1);
      }
      return word;
    })
    .join(" ");
};

export interface SubSegment {
  preview: string;
  start: number;
  end: number;
}

export const computeSubSegments = (
  segmentWords: SegmentWord[],
): SubSegment[] => {
  if (segmentWords.length === 0) return [];

  // Build split indices (word-level indices where we should split)
  const splitAfter = new Set<number>();

  for (let i = 0; i < segmentWords.length; i++) {
    const raw = segmentWords[i].word;
    // Check for mid-sentence period (not the last word)
    if (raw.endsWith(".") && i < segmentWords.length - 1) {
      splitAfter.add(i);
    }
    // Check for comma with >3 words on each side
    if (raw.endsWith(",")) {
      // Count words before this comma (back to start or last split)
      let wordsBefore = 0;
      for (let b = i; b >= 0 && !splitAfter.has(b - 1) && b !== -1; b--) {
        wordsBefore++;
      }
      // Count words after this comma (forward to next comma/period or end)
      let wordsAfter = 0;
      for (let a = i + 1; a < segmentWords.length; a++) {
        wordsAfter++;
        const w = segmentWords[a].word;
        if (
          w.endsWith(",") ||
          w.endsWith(".") ||
          w.endsWith("?") ||
          w.endsWith("!")
        )
          break;
      }

      if (wordsBefore > 3 && wordsAfter > 3) {
        splitAfter.add(i);
      }
    }
  }

  if (splitAfter.size === 0) {
    if (segmentWords.length > 15) {
      return findSubSegmentBySplitWord(segmentWords);
    }
    return [];
  }

  // Build sub-segments from split points
  const subSegments: SubSegment[] = [];
  let segStart = 0;

  const sortedSplits = [...splitAfter].sort((a, b) => a - b);
  for (const splitIdx of sortedSplits) {
    const sliceWords = segmentWords.slice(segStart, splitIdx + 1);
    if (sliceWords.length > 0) {
      const previewWords = sliceWords
        .slice(0, 3)
        .map((w) => removeSpecialPunctuation(w.word));
      subSegments.push({
        preview: previewWords.join(" ") + "...",
        start: sliceWords[0].start,
        end: sliceWords[sliceWords.length - 1].end,
      });
    }
    segStart = splitIdx + 1;
  }

  // Add the remaining words as the last sub-segment
  if (segStart < segmentWords.length) {
    const sliceWords = segmentWords.slice(segStart);
    const previewWords = sliceWords
      .slice(0, 3)
      .map((w) => removeSpecialPunctuation(w.word));
    subSegments.push({
      preview: previewWords.join(" ") + "...",
      start: sliceWords[0].start,
      end: sliceWords[sliceWords.length - 1].end,
    });
  }

  if (subSegments.length >= 2) return subSegments;

  return [];
};

const COMMON_SPLIT_WORDS = [
  "para",
  "y",
  "porque",
  "and",
  "because",
  "now",
  "ahora",
  "tal vez",
];

const findSubSegmentBySplitWord = (
  segmentWords: SegmentWord[],
): SubSegment[] => {
  const len = segmentWords.length;
  const mid = Math.floor(len / 2);

  // Find all candidate indices where a split word appears
  const candidates: number[] = [];
  for (let i = 0; i < len; i++) {
    const cleaned = stripPunctuation(segmentWords[i].word).toLowerCase();
    if (COMMON_SPLIT_WORDS.includes(cleaned)) {
      const wordsBefore = i;
      const wordsAfter = len - i - 1;
      if (wordsBefore >= 3 && wordsAfter >= 3) {
        candidates.push(i);
      }
    }
  }
  if (candidates.length === 0) return [];

  // Pick the candidate closest to the middle
  candidates.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  const splitIdx = candidates[0];

  const firstSlice = segmentWords.slice(0, splitIdx);
  const secondSlice = segmentWords.slice(splitIdx);

  const buildPreview = (words: SegmentWord[]) =>
    words
      .slice(0, 3)
      .map((w) => removeSpecialPunctuation(w.word))
      .join(" ") + "...";

  return [
    {
      preview: buildPreview(firstSlice),
      start: firstSlice[0].start,
      end: firstSlice[firstSlice.length - 1].end,
    },
    {
      preview: buildPreview(secondSlice),
      start: secondSlice[0].start,
      end: secondSlice[secondSlice.length - 1].end,
    },
  ];
};

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export const CEFR_COLORS: Record<CefrLevel, string> = {
  A1: "#2ecc71",
  A2: "#27ae60",
  B1: "#f39c12",
  B2: "#e67e22",
  C1: "#e74c3c",
  C2: "#8e44ad",
};

export const determineCefrLevel = (
  sentence: Sentence,
  allVocabulary: Record<string, Vocabulary>,
): CefrLevel => {
  const words = sentence.words;
  if (words.length === 0) return "A1";

  // 1. Words per minute (speech rate)
  const durationSeconds = sentence.end - sentence.start;
  const wpm = durationSeconds > 0 ? (words.length / durationSeconds) * 60 : 0;

  // 2. Vocabulary rarity - average percentile of known words
  let totalPercentile = 0;
  let vocabMatchCount = 0;
  let unknownWordCount = 0;
  for (const w of words) {
    const key = vocabFormatWord(w.word);
    const vocab = allVocabulary[key];
    if (vocab) {
      totalPercentile += vocab.percentile;
      vocabMatchCount++;
    } else if (key.length > 2) {
      // Word not in vocabulary at all — likely rare/specialized
      unknownWordCount++;
    }
  }
  const avgPercentile =
    vocabMatchCount > 0 ? totalPercentile / vocabMatchCount : 50;
  const unknownRatio = words.length > 0 ? unknownWordCount / words.length : 0;

  // 3. Sentence length (word count)
  const wordCount = words.length;

  // 4. Average word length (character complexity)
  const avgWordLength =
    words.reduce((sum, w) => sum + w.word.length, 0) / words.length;

  // Score each factor 0-100
  // WPM: typical range 80-220 for speech
  const wpmScore = Math.min(100, Math.max(0, ((wpm - 80) / 140) * 100));

  // Percentile: 1=common, 100=rare — use directly
  const vocabScore = avgPercentile + unknownRatio * 40;

  // Word count: 1-20+ words per sentence
  const lengthScore = Math.min(100, Math.max(0, ((wordCount - 2) / 16) * 100));

  // Avg word length: typically 3-10 chars
  const charScore = Math.min(100, Math.max(0, ((avgWordLength - 3) / 5) * 100));

  // Weighted composite
  const composite =
    wpmScore * 0.25 + vocabScore * 0.4 + lengthScore * 0.2 + charScore * 0.15;

  if (composite < 15) return "A1";
  if (composite < 30) return "A2";
  if (composite < 45) return "B1";
  if (composite < 60) return "B2";
  if (composite < 75) return "C1";
  return "C2";
};

// @ts-ignore
function _tryStealBetterMatch(
  details: AccuracyResult["details"],
  normalizedSpoken: string[],
  normalizedTarget: string,
  usedSpokenIndices: Set<number>,
  spokenWords: string[],
): {
  bestMatchIndex: number;
  bestMatchScore: number;
  matchedCountDelta: number;
  matchedScoreDelta: number;
} | null {
  let stealFrom = -1;
  let stealScore = 0;

  for (let d = 0; d < details.length; d++) {
    const prev = details[d];
    if (!prev.matched || prev.isProperNoun || prev._spokenIndex == null)
      continue;
    if (prev._matchScore === 1) continue; // don't steal perfect matches

    const scoreForCurrent = similarity(
      normalizedSpoken[prev._spokenIndex],
      normalizedTarget,
    );
    if (
      scoreForCurrent >= 0.6 &&
      scoreForCurrent > prev._matchScore! &&
      scoreForCurrent > stealScore
    ) {
      stealFrom = d;
      stealScore = scoreForCurrent;
    }
  }

  if (stealFrom === -1) return null;

  const prev = details[stealFrom];
  const stolenIndex = prev._spokenIndex!;
  let matchedCountDelta = 0;
  let matchedScoreDelta = 0;

  // Try to find a new match for the previous target among remaining words
  usedSpokenIndices.delete(stolenIndex);
  const prevNormTarget = normalize(prev.targetWord);
  let newBestIndex = -1;
  let newBestScore = 0;

  for (let i = 0; i < normalizedSpoken.length; i++) {
    if (usedSpokenIndices.has(i) || i === stolenIndex) continue;
    const s = similarity(normalizedSpoken[i], prevNormTarget);
    if (s > newBestScore && s >= 0.6) {
      newBestScore = s;
      newBestIndex = i;
    }
  }

  if (newBestIndex !== -1) {
    // Previous target gets a new (worse) match
    usedSpokenIndices.add(newBestIndex);
    prev.spokenWord =
      newBestScore === 1 ? prev.targetWord : spokenWords[newBestIndex];
    prev._spokenIndex = newBestIndex;
    matchedScoreDelta -= prev._matchScore!;
    matchedScoreDelta += newBestScore;
    prev._matchScore = newBestScore;
  } else {
    // Previous target becomes unmatched
    prev.matched = false;
    prev.spokenWord = undefined;
    prev._spokenIndex = undefined;
    matchedCountDelta--;
    matchedScoreDelta -= prev._matchScore!;
    prev._matchScore = undefined;
  }

  return {
    bestMatchIndex: stolenIndex,
    bestMatchScore: stealScore,
    matchedCountDelta,
    matchedScoreDelta,
  };
}
