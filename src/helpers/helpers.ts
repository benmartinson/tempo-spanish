import {
  Segment,
  Sentence,
  SegmentWord,
  VideoContext,
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

export const addEllipsis = (text: string, sentenceText?: string) => {
  const ref = sentenceText ?? text;
  const firstChar = ref.trimStart()[0];
  const needsLeading = firstChar
    ? firstChar !== firstChar.toUpperCase()
    : false;
  const lastWord = ref.trimEnd().split(" ").pop() ?? "";
  const needsTrailing = lastWord.includes(",");
  let result = text;
  if (needsTrailing) {
    result = result.replace(/[.,!?]+$/, "") + "...";
  }
  if (needsLeading) {
    result = "..." + result;
  }
  return result;
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

const SPANISH_NUMBER_WORDS: Record<string, string> = {
  cero: "0",
  uno: "1",
  una: "1",
  dos: "2",
  tres: "3",
  cuatro: "4",
  cinco: "5",
  seis: "6",
  siete: "7",
  ocho: "8",
  nueve: "9",
  diez: "10",
  once: "11",
  doce: "12",
  trece: "13",
  catorce: "14",
  quince: "15",
  dieciseis: "16",
  diecisiete: "17",
  dieciocho: "18",
  diecinueve: "19",
  veinte: "20",
  veintiuno: "21",
  veintidos: "22",
  veintitres: "23",
  veinticuatro: "24",
  veinticinco: "25",
  veintiseis: "26",
  veintisiete: "27",
  veintiocho: "28",
  veintinueve: "29",
  treinta: "30",
  cuarenta: "40",
  cincuenta: "50",
  sesenta: "60",
  setenta: "70",
  ochenta: "80",
  noventa: "90",
  cien: "100",
  ciento: "100",
  doscientos: "200",
  trescientos: "300",
  cuatrocientos: "400",
  quinientos: "500",
  seiscientos: "600",
  setecientos: "700",
  ochocientos: "800",
  novecientos: "900",
  mil: "1000",
};

export const normalize = (s: string): string => {
  const stripped = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^\w\s]/g, "") // punctuation
    .trim();
  return SPANISH_NUMBER_WORDS[stripped] ?? stripped;
};

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

export const hasUnnaturalSpeechTiming = (words: SegmentWord[]) => {
  let sameTimeCount = 0;
  for (let x = 0; x < words.length; ++x) {
    if (x === 0) continue;
    if (words[x].start === words[x - 1].start) {
      ++sameTimeCount;
      if (sameTimeCount === 3) {
        return true;
      }
    } else {
      sameTimeCount === 0;
    }

    if (words[x].start - words[x - 1].start > 4) {
      return true;
    }
  }
  return false;
};
