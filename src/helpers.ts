import { Segment, SegmentWord, Vocabulary } from "./types";

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
  alreadySelectedVocab: string[]
): Vocabulary[] => {
  const normalizedAlready = new Set(alreadySelectedVocab.map(normalizeWord));
  const filtered = vocab.filter(
    (v) =>
      !alreadyKnownVocab.includes(v.word.toLowerCase()) &&
      !ignoreVocab.some((i) => i.toLowerCase() === v.word.toLowerCase()) &&
      v.translation !== v.word &&
      !normalizedAlready.has(normalizeWord(v.word))
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
  vocab: Vocabulary[],
  allWords: SegmentWord[]
): SegmentWord[] => {
  const wordTimes = [];
  for (const word of vocab) {
    const normalizedWord = normalizeWord(word.word);
    const currentWordTimes = allWords
      .filter((w) => normalizeWord(w.word) === normalizedWord)
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
  currentSegment: number
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
      v.start >= nextSegmentStart
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

export const findSentenceWithVocab = (
  segment: Segment,
  wordTime: number
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
