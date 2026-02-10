import { Segment, SegmentWord, VideoContext, Vocabulary } from "./types";

export const canIgnoreVocab = (word: string) => {
  return ignoreVocab.includes(word) || alreadyKnownVocab.includes(word);
};

export const ignoreVocab = [
  "Por",
  "La",
  "Los",
  "Las",
  "El",
  "Un",
  "Una",
  "Unos",
  "Unas",
  "Los",
  "Las",
  "El",
  "Un",
  "Una",
  "Unos",
  "Unas",
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
];

export const alreadyKnownVocab = [
  "piso",
  "bajo",
  "otro",
  "automóvil",
  "nazi",
  "hombre",
  "respeto",
];

export const capitalize = (word: string) => {
  return word.charAt(0).toUpperCase() + word.slice(1);
};

export const stripPunctuation = (word: string) => {
  return word.replace(/[.,\/#!$%\^&\*\?;:{}=\-\"\'_`~()]/g, "");
};

export const normalizeWord = (word: string) =>
  capitalize(stripPunctuation(word.toLowerCase()));

export const randomlySelectVocabFromVocabulary = (
  vocab: Vocabulary[],
  count: number,
  alreadySelectedVocab: string[],
): Vocabulary[] => {
  const normalizedAlready = new Set(alreadySelectedVocab.map(normalizeWord));
  const filtered = vocab.filter(
    (v) =>
      !alreadyKnownVocab.includes(v.word.toLowerCase()) &&
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

export const findTimesForVocab = (
  allWords: SegmentWord[],
  currentVideo: VideoContext,
): SegmentWord[] => {
  const wordTimes = [];
  if (!currentVideo || !currentVideo.segments) return [];
  const vocab = currentVideo?.focusVocab || [];
  const lastPossibleTime =
    currentVideo?.segments[currentVideo?.segments.length - 1].end;
  for (const word of vocab) {
    const normalizedWord = normalizeWord(word.word);
    const currentWordTimes = allWords
      .filter((w) => normalizeWord(w.word) === normalizedWord)
      .filter((w) => w.start < lastPossibleTime)
      .map((w) => ({
        ...w,
        word: normalizeWord(word.word),
        translation: normalizeWord(word.translation),
      }));
    wordTimes.push(...currentWordTimes);
  }
  return wordTimes.sort((a, b) => a.start - b.start);
};

export const findNextSegmentWithVocab = (
  focusVocabTimes: SegmentWord[],
  word: SegmentWord,
  segments: Segment[],
  currentSegment: number,
): [Segment, SegmentWord] => {
  const nextSegmentStart = segments[currentSegment + 1].start;
  // console.log({
  //   focusVocabTimes: focusVocabTimes.map((v) => {
  //     return { word: normalizeWord(v.word), start: v.start, end: v.end };
  //   }),
  //   nextSegmentStart,
  //   normalizeWord: normalizeWord(word.word),
  // });
  const nextFocusVocabTime = focusVocabTimes.find(
    (v) =>
      normalizeWord(word.word) === normalizeWord(v.word) &&
      v.start >= nextSegmentStart,
  );
  if (!nextFocusVocabTime) {
    return [null, null];
  }
  for (let i = currentSegment + 1; i < segments.length; i++) {
    const segment = segments[i];
    if (
      nextFocusVocabTime.start >= segment.start &&
      nextFocusVocabTime.start <= segment.end
    ) {
      return [segment, nextFocusVocabTime];
    }
  }
  return [null, null];
};

// Helper function to split words into sentences based on punctuation
export const splitIntoSentences = (words: SegmentWord[]): SegmentWord[][] => {
  const sentences: SegmentWord[][] = [];
  let currentSentenceWords: SegmentWord[] = [];
  for (const word of words) {
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

export const getSentenceData = (
  clipWords: SegmentWord[],
  currentSentence: number,
  clipStart: number,
  clipEnd: number,
  currentSegment: number,
) => {
  const sentences = splitIntoSentences(clipWords);
  let sentencesText = clipWords
    .map((w) => w.word)
    .join(" ")
    .split(/[.!?]/)
    .map((s) => s.trim());
  // add period to end of each sentence
  sentencesText = sentencesText.map((s) => s + ".");

  const currentSentenceWords = sentences[currentSentence] || [];
  const sentenceStart = currentSentenceWords[0]?.start ?? clipStart;
  const rawEnd =
    currentSentenceWords[currentSentenceWords.length - 1]?.end ?? clipEnd;
  const sentenceEnd = parseFloat(rawEnd.toFixed(1)) + 0.1;
  const isLastSentence = currentSentence >= sentences.length - 1;
  const isFirstSentence = currentSentence === 0;
  const isFirstSegment = currentSegment === 0;

  return {
    sentences,
    currentSentenceWords,
    sentenceStart,
    sentenceEnd,
    isLastSentence,
    isFirstSentence,
    isFirstSegment,
    sentencesText,
  };
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

export const autoSelectVocabForVideo = (
  allWords: SegmentWord[],
  allVocabulary: Record<string, Vocabulary>,
  userKnownVocab: number[],
): Vocabulary[] => {
  const allSentences = splitIntoSentences(allWords);
  const selectedVocab = [];
  let index = 0;
  for (const sentence of allSentences) {
    index++;
    if (index % 2 === 0) continue;
    const lowestFrequencyWord = sentence
      .filter((w) => {
        const normalizedWord = stripPunctuation(w.word.toLowerCase());
        return (
          allVocabulary[normalizedWord] &&
          normalizedWord !== w.translation &&
          !userKnownVocab.includes(allVocabulary[normalizedWord].id) &&
          !ignoreVocab.includes(normalizedWord)
        );
      })
      .reduce(
        (min, word) => {
          const normalizedWord = stripPunctuation(word.word.toLowerCase());
          const vocabulary = allVocabulary[normalizedWord];
          const frequency = vocabulary?.frequency;
          if (frequency && frequency < min.frequency) {
            return { ...vocabulary };
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
