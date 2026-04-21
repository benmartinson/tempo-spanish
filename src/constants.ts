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
