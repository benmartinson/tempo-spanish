import { SegmentWord, Vocabulary } from "./types";

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

export const randomlySelectVocab = (
  vocab: Vocabulary[],
  count: number,
  alreadySelectedVocab: string[]
) => {
  const filteredWords = vocab.filter(
    (word) =>
      !alreadyKnownVocab.includes(word.word) &&
      !ignoreVocab.includes(word.word) &&
      word.translation !== word.word &&
      !alreadySelectedVocab.includes(word.word)
  );
  const wordSet = new Set(
    filteredWords.map((word) => capitalize(stripPunctuation(word.word)))
  );
  const selectedWords = Array.from(wordSet)
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
  return selectedWords;
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
) => {
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
