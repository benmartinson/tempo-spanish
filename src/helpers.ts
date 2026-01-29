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
