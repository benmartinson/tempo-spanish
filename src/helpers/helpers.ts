import {
  ABBREVIATIONS,
  COMMON_SPLIT_WORDS,
  SPANISH_NUMBER_WORDS,
} from "../constants";
import {
  Segment,
  Sentence,
  SegmentWord,
  VideoContext,
  AccuracyResult,
  VocabCacheEntry,
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

export const splitIntoSentences = (words: SegmentWord[]): SegmentWord[][] => {
  const sentences: SegmentWord[][] = [];
  let currentSentenceWords: SegmentWord[] = [];
  for (const word of words) {
    word.word = word.word.trim();
    currentSentenceWords.push(word);
    // Check if word ends with sentence-ending punctuation, but not abbreviations
    const bare = word.word.replace(/^[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]*/, "");
    if (/[.!?]$/.test(word.word)) {
      if (ABBREVIATIONS.has(bare)) {
        // Abbreviation — look back for a ".,"-marked word to split on instead
        for (let i = currentSentenceWords.length - 2; i >= 0; i--) {
          if (/\.,$/.test(currentSentenceWords[i].word)) {
            sentences.push(currentSentenceWords.slice(0, i + 1));
            currentSentenceWords = currentSentenceWords.slice(i + 1);
            break;
          }
        }
      } else {
        sentences.push(currentSentenceWords);
        currentSentenceWords = [];
      }
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

// Multi-word phrases where the first word's trailing comma should be stripped
const PHRASE_PAIRS: [string, string][] = [
  ["sin", "embargo"],
  ["por", "un"],
  ["por", "lo"],
  ["por", "ejemplo"],
  ["por", "cierto"],
  ["por", "tanto"],
  ["un", "lado"],
  ["lo", "tanto"],
  ["lo", "general"],
  ["en", "parte"],
  ["en", "cambio"],
  ["sobre", "todo"],
  ["y", "sobre"],
];

// Strip trailing comma from a word if it and the next word form a known phrase
export const stripPhraseComma = (word: string, nextWord?: string): string => {
  if (!nextWord || !word.endsWith(",")) return word;
  const base = word.slice(0, -1).toLowerCase();
  const nextBase = nextWord.replace(/[,.]$/, "").toLowerCase();
  if (PHRASE_PAIRS.some(([a, b]) => a === base && b === nextBase)) {
    return word.slice(0, -1);
  }
  return word;
};

// Clean phrase commas in a full text string
export const cleanPhraseCommas = (text: string): string => {
  const words = text.split(/\s+/);
  return words.map((w, i) => stripPhraseComma(w, words[i + 1])).join(" ");
};

export type DifficultyLevel =
  | "moderate"
  | "challenging"
  | "difficult"
  | "hardest";

export const getAutoHintDifficulty = (
  charCount: number,
  level: DifficultyLevel,
): number => {
  switch (level) {
    case "moderate":
      if (charCount <= 72) return 2;
      if (charCount <= 120) return 1;
      return 0;
    case "challenging":
      if (charCount <= 72) return 3;
      if (charCount <= 120) return 2;
      if (charCount <= 180) return 1;
      return 0;
    case "difficult":
      if (charCount <= 72) return 4;
      if (charCount <= 120) return 3;
      if (charCount <= 180) return 2;
      return 1;
    case "hardest":
      if (charCount <= 96) return 4;
      if (charCount <= 180) return 3;
      return 2;
  }
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

export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

export interface ComputeMatchedTimedWordsParams {
  words: string[]; // English translation words in display order
  wordsToTranslate: SegmentWord[]; // Spanish content words with real timings
  vocabCache: VocabCacheEntry[]; // per-word translations (Spanish word -> English)
  segmentStart: number;
  segmentEnd: number;
}

/**
 * Builds timed word entries for an English translation by matching each English word
 * to the Spanish word whose translation contains it. Unmatched English words get
 * linearly interpolated timings between the nearest matched neighbors. Returns null
 * if no matches could be made (caller should fall back to uniform distribution).
 */
export const computeMatchedTimedWords = ({
  words,
  wordsToTranslate,
  vocabCache,
  segmentStart,
  segmentEnd,
}: ComputeMatchedTimedWordsParams): TimedWord[] | null => {
  const duration = segmentEnd - segmentStart;
  if (!words.length || duration <= 0) return null;

  // Strips punctuation, lowercases, and removes diacritics — used to match
  // Spanish words case- and accent-insensitively (e.g. "Pero" vs "pero",
  // "más" vs "mas"), and similarly for English lookup.
  const norm = (w: string) =>
    stripDiacritics(stripPunctuation(w.trim().toLowerCase()));

  // Index the vocab cache by normalized Spanish word — multiple entries per
  // word are supported (e.g. "para" with translations "for" and "so").
  const cacheByNorm = new Map<string, VocabCacheEntry[]>();
  for (const c of vocabCache) {
    const key = norm(c.word);
    if (!key) continue;
    if (!cacheByNorm.has(key)) cacheByNorm.set(key, []);
    cacheByNorm.get(key)!.push(c);
  }

  // english word -> matched Spanish timing (first match wins)
  const lookup = new Map<string, { start: number; end: number }>();
  for (const sp of wordsToTranslate) {
    const entries = cacheByNorm.get(norm(sp.word));
    if (!entries) continue;
    for (const entry of entries) {
      if (!entry.translation) continue;
      for (const piece of entry.translation.split(/\s+/)) {
        const key = norm(piece);
        if (!key || lookup.has(key)) continue;
        lookup.set(key, { start: sp.start, end: sp.end });
      }
    }
  }

  if (!lookup.size) return null;

  const matched: ({ start: number; end: number } | null)[] = words.map((w) => {
    return lookup.get(norm(w)) ?? null;
  });

  // Keep only the longest non-decreasing subsequence of matched times; drop
  // outliers (e.g. an early-position English word that first-match-wins mapped
  // to a late Spanish time). This preserves the bulk of good timing data rather
  // than bumping everything forward to accommodate one bad match.
  const matchedIndices: number[] = [];
  const matchedTimes: number[] = [];
  for (let i = 0; i < words.length; i++) {
    if (matched[i]) {
      matchedIndices.push(i);
      matchedTimes.push(matched[i]!.start);
    }
  }
  if (matchedIndices.length > 1) {
    const n = matchedTimes.length;
    const dp = new Array<number>(n).fill(1);
    const parent = new Array<number>(n).fill(-1);
    let bestEnd = 0;
    for (let i = 1; i < n; i++) {
      for (let j = 0; j < i; j++) {
        if (matchedTimes[j] <= matchedTimes[i] && dp[j] + 1 > dp[i]) {
          dp[i] = dp[j] + 1;
          parent[i] = j;
        }
      }
      if (dp[i] > dp[bestEnd]) bestEnd = i;
    }
    const keep = new Set<number>();
    for (let k = bestEnd; k !== -1; k = parent[k]) {
      keep.add(matchedIndices[k]);
    }
    for (let i = 0; i < words.length; i++) {
      if (matched[i] && !keep.has(i)) matched[i] = null;
    }
  }

  const result: TimedWord[] = [];
  for (let i = 0; i < words.length; i++) {
    if (matched[i]) {
      result.push({ word: words[i], ...matched[i]! });
      continue;
    }
    let prevIdx = i - 1;
    while (prevIdx >= 0 && !matched[prevIdx]) prevIdx--;
    let nextIdx = i + 1;
    while (nextIdx < words.length && !matched[nextIdx]) nextIdx++;

    const prev = prevIdx >= 0 ? matched[prevIdx] : null;
    const next = nextIdx < words.length ? matched[nextIdx] : null;

    let t: number;
    if (prev && next) {
      const ratio = (i - prevIdx) / (nextIdx - prevIdx);
      t = prev.start + (next.start - prev.start) * ratio;
    } else if (prev) {
      t = prev.end;
    } else if (next) {
      t = next.start;
    } else {
      t = segmentStart + (i / words.length) * duration;
    }
    result.push({ word: words[i], start: t, end: t });
  }

  // Safety net: enforce monotonic non-decreasing (LIS should have ensured this,
  // but interpolation edge cases could still violate it).
  for (let i = 1; i < result.length; i++) {
    if (result[i].start < result[i - 1].start) {
      result[i] = {
        ...result[i],
        start: result[i - 1].start,
        end: Math.max(result[i].end, result[i - 1].start),
      };
    }
    if (result[i].end < result[i].start) {
      result[i] = { ...result[i], end: result[i].start };
    }
  }

  return result;
};
