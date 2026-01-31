import { SegmentWord } from "./types";

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
  return word.replace(/[.,\/#!$%\^&\*\?;:{}=\-_`~()]/g, "");
};

export const randomlySelectVocab = (vocab: SegmentWord[], count: number) => {
  const filteredWords = vocab.filter(word => !alreadyKnownVocab.includes(word.word) && !ignoreVocab.includes(word.word) && word.translation !== word.word);
  const wordSet = new Set(filteredWords.map(word => capitalize(stripPunctuation(word.word))));
  const selectedWords = Array.from(wordSet).sort(() => Math.random() - 0.5).slice(0, count);
  return selectedWords;
};