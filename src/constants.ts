export const CHAR_WIDTHS: Record<string, number> = {
  a: 11, //
  b: 12, //
  c: 11, //
  d: 12, //
  e: 11, //
  f: 8, //
  g: 12, //
  h: 12, //
  i: 6, //
  j: 6, //
  k: 11, //
  l: 6, //
  m: 17, //
  n: 11, //
  o: 11, //
  p: 12, //
  q: 12, //
  r: 8, //
  s: 10, //
  t: 8, //
  u: 12, //
  v: 10, //
  w: 15, //
  x: 10, //
  y: 11, //
  z: 10, //
  A: 12, //
  B: 12, //
  C: 13, //
  D: 13, //
  E: 11, //
  F: 11, //
  G: 13, //
  H: 14, //
  I: 6, //
  J: 10, //
  K: 11, //
  L: 11, //
  M: 16, //
  N: 14,
  O: 14,
  P: 12, //
  Q: 14,
  R: 12,
  S: 12,
  T: 11,
  U: 13,
  V: 12, //
  W: 17,
  X: 12,
  Y: 12,
  Z: 12,
};
export const DEFAULT_CHAR_WIDTH = 11;
// TEMPORARY: set to a letter to test its width, e.g. "j". Set to null to use actual first letter.
export const TEST_CHAR: string | null = null;

export interface CommonWordEntry {
  word: string;
  translations: string[];
}

/**
 * Hardcoded Spanish→English translations for common words that are often
 * skipped, mistranslated, or missing from the per-sentence vocab cache.
 * Words are stored in normalized form (lowercase, no diacritics). Each entry
 * can supply multiple English translations; any of them matching a word in the
 * display text is enough to anchor the timing.
 */
export const COMMON_WORD_TRANSLATIONS: CommonWordEntry[] = [
  // Common conjunctions / connectors
  { word: "pero", translations: ["but"] },
  { word: "sino", translations: ["but"] },
  { word: "y", translations: ["and"] },
  { word: "e", translations: ["and"] },
  { word: "o", translations: ["or"] },
  { word: "no", translations: ["not", "no"] },
  { word: "ya", translations: ["already", "now"] },
  { word: "es", translations: ["is"] },

  // Prepositions
  { word: "a", translations: ["to", "at"] },
  { word: "ante", translations: ["before"] },
  { word: "bajo", translations: ["under", "beneath"] },
  { word: "con", translations: ["with"] },
  { word: "contra", translations: ["against"] },
  { word: "de", translations: ["of", "from"] },
  { word: "desde", translations: ["from", "since"] },
  { word: "durante", translations: ["during"] },
  { word: "en", translations: ["in", "on", "at"] },
  { word: "entre", translations: ["between", "among"] },
  { word: "hacia", translations: ["toward", "towards"] },
  { word: "hasta", translations: ["until", "up", "to"] },
  { word: "mediante", translations: ["through", "by"] },
  { word: "para", translations: ["for", "so", "to"] },
  { word: "por", translations: ["for", "by", "through"] },
  { word: "segun", translations: ["according"] },
  { word: "sin", translations: ["without"] },
  { word: "so", translations: ["under"] },
  { word: "sobre", translations: ["on", "about", "over"] },
  { word: "tras", translations: ["after", "behind"] },
  { word: "versus", translations: ["versus"] },
  { word: "via", translations: ["via", "through"] },

  // Personal pronouns
  { word: "yo", translations: ["I"] },
  { word: "tu", translations: ["you", "your"] },
  { word: "el", translations: ["he", "it", "the"] },
  { word: "ella", translations: ["she", "her", "it"] },
  { word: "usted", translations: ["you"] },
  { word: "nosotros", translations: ["we", "us"] },
  { word: "nosotras", translations: ["we", "us"] },
  { word: "vosotros", translations: ["you"] },
  { word: "vosotras", translations: ["you"] },
  { word: "ellos", translations: ["they", "them"] },
  { word: "ellas", translations: ["they", "them"] },
  { word: "ustedes", translations: ["you"] },
  { word: "me", translations: ["me", "myself"] },
  { word: "te", translations: ["you", "yourself"] },
  { word: "lo", translations: ["it", "him", "the"] },
  { word: "la", translations: ["the", "her", "it"] },
  { word: "le", translations: ["him", "her"] },
  { word: "nos", translations: ["us", "ourselves"] },
  { word: "os", translations: ["you"] },
  { word: "los", translations: ["them", "the"] },
  { word: "las", translations: ["them", "the"] },
  { word: "les", translations: ["them"] },
  { word: "mi", translations: ["my", "me"] },
  { word: "ti", translations: ["you"] },
  { word: "si", translations: ["if", "yourself"] },
  { word: "conmigo", translations: ["with", "me"] },
  { word: "contigo", translations: ["with", "you"] },
  { word: "consigo", translations: ["with"] },

  // Possessive pronouns
  { word: "mio", translations: ["mine"] },
  { word: "mia", translations: ["mine"] },
  { word: "mios", translations: ["mine"] },
  { word: "mias", translations: ["mine"] },
  { word: "tuyo", translations: ["yours"] },
  { word: "tuya", translations: ["yours"] },
  { word: "tuyos", translations: ["yours"] },
  { word: "tuyas", translations: ["yours"] },
  { word: "su", translations: ["his", "her", "its", "their"] },
  { word: "sus", translations: ["his", "her", "its", "their"] },
  { word: "suyo", translations: ["his", "hers", "theirs"] },
  { word: "suya", translations: ["his", "hers", "theirs"] },
  { word: "suyos", translations: ["his", "hers", "theirs"] },
  { word: "suyas", translations: ["his", "hers", "theirs"] },
  { word: "nuestro", translations: ["our", "ours"] },
  { word: "nuestra", translations: ["our", "ours"] },
  { word: "nuestros", translations: ["our", "ours"] },
  { word: "nuestras", translations: ["our", "ours"] },
  { word: "vuestro", translations: ["your", "yours"] },
  { word: "vuestra", translations: ["your", "yours"] },
  { word: "vuestros", translations: ["your", "yours"] },
  { word: "vuestras", translations: ["your", "yours"] },

  // Demonstrative pronouns
  { word: "este", translations: ["this"] },
  { word: "esta", translations: ["this"] },
  { word: "estos", translations: ["these"] },
  { word: "estas", translations: ["these"] },
  { word: "esto", translations: ["this"] },
  { word: "ese", translations: ["that"] },
  { word: "esa", translations: ["that"] },
  { word: "esos", translations: ["those"] },
  { word: "esas", translations: ["those"] },
  { word: "eso", translations: ["that"] },
  { word: "aquel", translations: ["that"] },
  { word: "aquella", translations: ["that"] },
  { word: "aquellos", translations: ["those"] },
  { word: "aquellas", translations: ["those"] },
  { word: "aquello", translations: ["that"] },

  // Relative / interrogative pronouns
  { word: "que", translations: ["that", "what", "which", "who"] },
  { word: "quien", translations: ["who"] },
  { word: "quienes", translations: ["who"] },
  { word: "cual", translations: ["which", "what"] },
  { word: "cuales", translations: ["which"] },
  { word: "cuyo", translations: ["whose"] },
  { word: "cuya", translations: ["whose"] },
  { word: "cuyos", translations: ["whose"] },
  { word: "cuyas", translations: ["whose"] },

  // Indefinite pronouns
  { word: "algo", translations: ["something"] },
  { word: "alguien", translations: ["someone"] },
  { word: "nada", translations: ["nothing"] },
  { word: "nadie", translations: ["nobody"] },
  { word: "todo", translations: ["all", "every", "everything"] },
  { word: "todos", translations: ["all", "everyone"] },
  { word: "todas", translations: ["all", "everyone"] },
  { word: "otro", translations: ["other", "another"] },
  { word: "otra", translations: ["other", "another"] },
  { word: "otros", translations: ["other", "others"] },
  { word: "otras", translations: ["other", "others"] },
  { word: "uno", translations: ["one", "a"] },
  { word: "una", translations: ["one", "a"] },
  { word: "unos", translations: ["some"] },
  { word: "unas", translations: ["some"] },

  // Miscellaneous high-frequency
  { word: "se", translations: ["himself", "herself", "itself"] },
  { word: "muy", translations: ["very"] },
  { word: "mas", translations: ["more", "but"] },
  { word: "donde", translations: ["where"] },
];

export const SPANISH_PREPOSITIONS = [
  "a",
  "ante",
  "bajo",
  "cabe",
  "con",
  "contra",
  "de",
  "desde",
  "durante",
  "en",
  "entre",
  "hacia",
  "hasta",
  "mediante",
  "para",
  "por",
  "segun",
  "sin",
  "so",
  "sobre",
  "tras",
  "versus",
  "via",
  "no",
  "sino",
  "ya",
  "o",
  "y",
];

export const SPANISH_PRONOUNS = [
  "yo",
  "tu",
  "el",
  "ella",
  "usted",
  "nosotros",
  "nosotras",
  "vosotros",
  "vosotras",
  "ellos",
  "ellas",
  "ustedes",
  "me",
  "te",
  "lo",
  "la",
  "le",
  "nos",
  "os",
  "los",
  "las",
  "les",
  "mi",
  "ti",
  "si",
  "conmigo",
  "contigo",
  "consigo",
  "mio",
  "mia",
  "mios",
  "mias",
  "tuyo",
  "tuya",
  "tuyos",
  "tuyas",
  "su",
  "sus",
  "suyo",
  "suya",
  "suyos",
  "suyas",
  "nuestro",
  "nuestra",
  "nuestros",
  "nuestras",
  "vuestro",
  "vuestra",
  "vuestros",
  "vuestras",
  "este",
  "esta",
  "estos",
  "estas",
  "esto",
  "ese",
  "esa",
  "esos",
  "esas",
  "eso",
  "aquel",
  "aquella",
  "aquellos",
  "aquellas",
  "aquello",
  "que",
  "quien",
  "quienes",
  "cual",
  "cuales",
  "cuyo",
  "cuya",
  "cuyos",
  "cuyas",
  "que",
  "quien",
  "quienes",
  "cual",
  "cuales",
  "algo",
  "alguien",
  "nada",
  "nadie",
  "todo",
  "todos",
  "todas",
  "otro",
  "otra",
  "otros",
  "otras",
  "uno",
  "una",
  "unos",
  "unas",
  "se",
  "muy",
  "mas",
];

export const SPANISH_NUMBER_WORDS: Record<string, string> = {
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

export const ABBREVIATIONS = new Set([
  "Dr.",
  "Mr.",
  "Mrs.",
  "Ms.",
  "Sr.",
  "Sra.",
  "Srta.",
  "Prof.",
  "Dra.",
  "Jr.",
  "St.",
  "Ave.",
  "vs.",
  "etc.",
  "Ud.",
  "Uds.",
  "Lic.",
  "Ing.",
  "a.c.",
  "b.c.",
]);

export const COMMON_SPLIT_WORDS = [
  "para",
  "y",
  "porque",
  "and",
  "because",
  "now",
  "ahora",
  "tal vez",
];
