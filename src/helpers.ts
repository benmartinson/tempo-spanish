import {
  Segment,
  Sentence,
  SegmentWord,
  VideoContext,
  Vocabulary,
  ContextSegment,
} from "./types";

export const formatTimestamp = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
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

// export const findTimesForVocab = (
//   allWords: SegmentWord[],
//   currentVideo: VideoContext,
// ): SegmentWord[] => {
//   const wordTimes = [];
//   if (!currentVideo || !currentVideo.segments) return [];
//   const vocab: SegmentWord[] = currentVideo?.focusVocab || [];
//   const lastPossibleTime =
//     currentVideo?.segments[currentVideo?.segments.length - 1].end;
//   for (const word of vocab) {
//     const normalizedWord = normalizeWord(word.word);
//     const currentWordTimes = allWords
//       .filter((w) => normalizeWord(w.word) === normalizedWord)
//       .filter((w) => w.start < lastPossibleTime)
//       .map((w) => ({
//         ...w,
//         word: normalizeWord(word.word),
//         translation: normalizeWord(word.translation),
//       }));
//     wordTimes.push(...currentWordTimes);
//   }
//   return wordTimes.sort((a, b) => a.start - b.start);
// };

// export const findNextSegmentWithVocab = (
//   focusVocab: SegmentWord[],
//   word: SegmentWord,
//   segments: Segment[],
//   currentSegment: number,
// ): [Segment, SegmentWord] => {
//   const nextSegmentStart = segments[currentSegment + 1].start;
//   // console.log({
//   //   focusVocabTimes: focusVocabTimes.map((v) => {
//   //     return { word: normalizeWord(v.word), start: v.start, end: v.end };
//   //   }),
//   //   nextSegmentStart,
//   //   normalizeWord: normalizeWord(word.word),
//   // });
//   const nextFocusVocabTime = focusVocab.find(
//     (v) =>
//       normalizeWord(word.word) === normalizeWord(v.word) &&
//       v.start >= nextSegmentStart,
//   );
//   if (!nextFocusVocabTime) {
//     return [null, null];
//   }
//   for (let i = currentSegment + 1; i < segments.length; i++) {
//     const segment = segments[i];
//     if (
//       nextFocusVocabTime.start >= segment.start &&
//       nextFocusVocabTime.start <= segment.end
//     ) {
//       return [segment, nextFocusVocabTime];
//     }
//   }
//   return [null, null];
// };

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

export const removeSpecialPunctuation = (word: string) => {
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
      // Count words after this comma (forward to end or next split candidate)
      let wordsAfter = segmentWords.length - 1 - i;

      if (wordsBefore > 3 && wordsAfter > 3) {
        splitAfter.add(i);
      }
    }
  }

  if (splitAfter.size === 0) return [];

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

  return subSegments.length >= 2 ? subSegments : [];
};
