type PersonForms = readonly [string, string, string, string, string, string];

type StemChangeKind = "e-ie" | "e-i" | "o-ue" | "u-ue";

interface VerbOverride {
  present?: PersonForms;
  presentYo?: string;
  preterite?: PersonForms;
  preteriteStem?: string;
  preteriteThirdSingular?: string;
  imperfect?: PersonForms;
  futureStem?: string;
  subjunctive?: PersonForms;
  subjunctiveStem?: string;
  stemChange?: StemChangeKind;
  preteriteY?: boolean;
  gerund?: string;
  participle?: string;
  imperativeTu?: string;
  extraForms?: readonly string[];
}

export const SPANISH_VERB_INFINITIVES = [
  "abandonar",
  "abrazar",
  "abrir",
  "acabar",
  "aceptar",
  "acompañar",
  "acordar",
  "actuar",
  "agradecer",
  "alcanzar",
  "amar",
  "andar",
  "añadir",
  "aparecer",
  "apoyar",
  "aprender",
  "aprovechar",
  "aprobar",
  "arrancar",
  "arreglar",
  "asegurar",
  "asistir",
  "atender",
  "atraer",
  "avanzar",
  "avisar",
  "bailar",
  "bajar",
  "beber",
  "buscar",
  "caer",
  "cambiar",
  "caminar",
  "cantar",
  "cerrar",
  "comenzar",
  "comer",
  "comprar",
  "comprender",
  "conocer",
  "conseguir",
  "construir",
  "contar",
  "continuar",
  "convertir",
  "correr",
  "cortar",
  "crear",
  "creer",
  "cubrir",
  "cuidar",
  "cumplir",
  "dar",
  "deber",
  "decidir",
  "decir",
  "dedicar",
  "defender",
  "dejar",
  "depender",
  "descubrir",
  "desear",
  "dirigir",
  "disfrutar",
  "dormir",
  "elegir",
  "empezar",
  "encontrar",
  "entender",
  "entrar",
  "enviar",
  "escribir",
  "escuchar",
  "esperar",
  "estar",
  "estudiar",
  "existir",
  "explicar",
  "faltar",
  "formar",
  "ganar",
  "gastar",
  "guardar",
  "gustar",
  "haber",
  "hablar",
  "hacer",
  "importar",
  "incluir",
  "iniciar",
  "intentar",
  "interesar",
  "invitar",
  "ir",
  "jugar",
  "leer",
  "levantar",
  "llamar",
  "llegar",
  "llevar",
  "llorar",
  "lograr",
  "mandar",
  "mantener",
  "marcar",
  "medir",
  "mentir",
  "mezclar",
  "mirar",
  "morir",
  "mostrar",
  "mover",
  "nacer",
  "necesitar",
  "negar",
  "ocurrir",
  "ofrecer",
  "oír",
  "olvidar",
  "pagar",
  "parar",
  "parecer",
  "partir",
  "pasar",
  "pedir",
  "pensar",
  "perder",
  "permitir",
  "poder",
  "poner",
  "preguntar",
  "preparar",
  "presentar",
  "probar",
  "producir",
  "quedar",
  "querer",
  "quitar",
  "recibir",
  "reconocer",
  "recordar",
  "reducir",
  "regresar",
  "reír",
  "repetir",
  "resolver",
  "responder",
  "resultar",
  "romper",
  "saber",
  "sacar",
  "salir",
  "seguir",
  "sentar",
  "sentir",
  "ser",
  "servir",
  "significar",
  "soler",
  "soñar",
  "subir",
  "suceder",
  "sufrir",
  "tener",
  "terminar",
  "tocar",
  "tomar",
  "trabajar",
  "traer",
  "tratar",
  "unir",
  "usar",
  "valer",
  "vender",
  "venir",
  "ver",
  "viajar",
  "visitar",
  "vivir",
  "volver",
  "votar",
] as const;

export type SpanishVerbMatchKey = (typeof SPANISH_VERB_INFINITIVES)[number];

const VERB_OVERRIDES: Partial<Record<SpanishVerbMatchKey, VerbOverride>> = {
  acordar: { stemChange: "o-ue" },
  agradecer: { presentYo: "agradezco" },
  andar: { preteriteStem: "anduv" },
  aparecer: { presentYo: "aparezco" },
  aprobar: { stemChange: "o-ue" },
  atender: { stemChange: "e-ie" },
  atraer: {
    presentYo: "atraigo",
    preteriteStem: "atraj",
    gerund: "atrayendo",
  },
  caer: { presentYo: "caigo", preteriteY: true, gerund: "cayendo" },
  cerrar: { stemChange: "e-ie" },
  comenzar: { stemChange: "e-ie" },
  conocer: { presentYo: "conozco" },
  conseguir: {
    present: [
      "consigo",
      "consigues",
      "consigue",
      "conseguimos",
      "conseguís",
      "consiguen",
    ],
    subjunctiveStem: "consig",
    stemChange: "e-i",
    gerund: "consiguiendo",
  },
  construir: {
    present: [
      "construyo",
      "construyes",
      "construye",
      "construimos",
      "construís",
      "construyen",
    ],
    subjunctiveStem: "construy",
    preteriteY: true,
    gerund: "construyendo",
  },
  contar: { stemChange: "o-ue" },
  convertir: { stemChange: "e-ie" },
  creer: { preteriteY: true, gerund: "creyendo" },
  cubrir: { participle: "cubierto" },
  dar: {
    present: ["doy", "das", "da", "damos", "dais", "dan"],
    preterite: ["di", "diste", "dio", "dimos", "disteis", "dieron"],
    subjunctive: ["dé", "des", "dé", "demos", "deis", "den"],
  },
  decir: {
    present: ["digo", "dices", "dice", "decimos", "decís", "dicen"],
    preterite: ["dije", "dijiste", "dijo", "dijimos", "dijisteis", "dijeron"],
    futureStem: "dir",
    subjunctiveStem: "dig",
    gerund: "diciendo",
    participle: "dicho",
    imperativeTu: "di",
  },
  defender: { stemChange: "e-ie" },
  descubrir: { participle: "descubierto" },
  dirigir: { presentYo: "dirijo", subjunctiveStem: "dirij" },
  dormir: { stemChange: "o-ue", gerund: "durmiendo" },
  elegir: {
    present: ["elijo", "eliges", "elige", "elegimos", "elegís", "eligen"],
    subjunctiveStem: "elij",
    stemChange: "e-i",
  },
  empezar: { stemChange: "e-ie" },
  encontrar: { stemChange: "o-ue" },
  entender: { stemChange: "e-ie" },
  escribir: { participle: "escrito" },
  estar: {
    present: ["estoy", "estás", "está", "estamos", "estáis", "están"],
    preteriteStem: "estuv",
    subjunctive: ["esté", "estés", "esté", "estemos", "estéis", "estén"],
  },
  haber: {
    present: ["he", "has", "ha", "hemos", "habéis", "han"],
    preteriteStem: "hub",
    futureStem: "habr",
    subjunctive: ["haya", "hayas", "haya", "hayamos", "hayáis", "hayan"],
    gerund: "habiendo",
    participle: "habido",
    extraForms: ["hay"],
  },
  hacer: {
    presentYo: "hago",
    preteriteStem: "hic",
    preteriteThirdSingular: "hizo",
    futureStem: "har",
    subjunctiveStem: "hag",
    participle: "hecho",
    imperativeTu: "haz",
  },
  incluir: {
    present: [
      "incluyo",
      "incluyes",
      "incluye",
      "incluimos",
      "incluís",
      "incluyen",
    ],
    subjunctiveStem: "incluy",
    preteriteY: true,
    gerund: "incluyendo",
  },
  ir: {
    present: ["voy", "vas", "va", "vamos", "vais", "van"],
    preterite: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
    imperfect: ["iba", "ibas", "iba", "íbamos", "ibais", "iban"],
    subjunctive: ["vaya", "vayas", "vaya", "vayamos", "vayáis", "vayan"],
    gerund: "yendo",
    participle: "ido",
    imperativeTu: "ve",
  },
  jugar: { stemChange: "u-ue" },
  leer: { preteriteY: true, gerund: "leyendo" },
  mantener: {
    present: [
      "mantengo",
      "mantienes",
      "mantiene",
      "mantenemos",
      "mantenéis",
      "mantienen",
    ],
    preteriteStem: "mantuv",
    futureStem: "mantendr",
    subjunctiveStem: "manteng",
    imperativeTu: "mantén",
  },
  medir: { stemChange: "e-i", gerund: "midiendo" },
  mentir: { stemChange: "e-ie", gerund: "mintiendo" },
  morir: { stemChange: "o-ue", gerund: "muriendo", participle: "muerto" },
  mostrar: { stemChange: "o-ue" },
  mover: { stemChange: "o-ue" },
  nacer: { presentYo: "nazco" },
  negar: { stemChange: "e-ie" },
  ofrecer: { presentYo: "ofrezco" },
  oír: {
    present: ["oigo", "oyes", "oye", "oímos", "oís", "oyen"],
    subjunctiveStem: "oig",
    preterite: ["oí", "oíste", "oyó", "oímos", "oísteis", "oyeron"],
    gerund: "oyendo",
  },
  parecer: { presentYo: "parezco" },
  pedir: { stemChange: "e-i", gerund: "pidiendo" },
  pensar: { stemChange: "e-ie" },
  perder: { stemChange: "e-ie" },
  poder: {
    stemChange: "o-ue",
    preteriteStem: "pud",
    futureStem: "podr",
    gerund: "pudiendo",
  },
  poner: {
    presentYo: "pongo",
    preteriteStem: "pus",
    futureStem: "pondr",
    subjunctiveStem: "pong",
    participle: "puesto",
    imperativeTu: "pon",
  },
  probar: { stemChange: "o-ue" },
  producir: {
    presentYo: "produzco",
    preteriteStem: "produj",
    subjunctiveStem: "produzc",
  },
  querer: {
    stemChange: "e-ie",
    preteriteStem: "quis",
    futureStem: "querr",
  },
  reconocer: { presentYo: "reconozco" },
  recordar: { stemChange: "o-ue" },
  reducir: {
    presentYo: "reduzco",
    preteriteStem: "reduj",
    subjunctiveStem: "reduzc",
  },
  reír: {
    present: ["río", "ríes", "ríe", "reímos", "reís", "ríen"],
    preterite: ["reí", "reíste", "rio", "reímos", "reísteis", "rieron"],
    subjunctive: ["ría", "rías", "ría", "riamos", "riáis", "rían"],
    gerund: "riendo",
  },
  repetir: { stemChange: "e-i", gerund: "repitiendo" },
  resolver: { stemChange: "o-ue", participle: "resuelto" },
  romper: { participle: "roto" },
  saber: {
    present: ["sé", "sabes", "sabe", "sabemos", "sabéis", "saben"],
    preteriteStem: "sup",
    futureStem: "sabr",
    subjunctiveStem: "sep",
  },
  salir: {
    presentYo: "salgo",
    futureStem: "saldr",
    subjunctiveStem: "salg",
    imperativeTu: "sal",
  },
  seguir: {
    present: ["sigo", "sigues", "sigue", "seguimos", "seguís", "siguen"],
    subjunctiveStem: "sig",
    stemChange: "e-i",
    gerund: "siguiendo",
  },
  sentar: { stemChange: "e-ie" },
  sentir: { stemChange: "e-ie", gerund: "sintiendo" },
  ser: {
    present: ["soy", "eres", "es", "somos", "sois", "son"],
    preterite: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
    imperfect: ["era", "eras", "era", "éramos", "erais", "eran"],
    subjunctive: ["sea", "seas", "sea", "seamos", "seáis", "sean"],
    imperativeTu: "sé",
  },
  servir: { stemChange: "e-i", gerund: "sirviendo" },
  soler: { stemChange: "o-ue" },
  soñar: { stemChange: "o-ue" },
  tener: {
    present: ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"],
    preteriteStem: "tuv",
    futureStem: "tendr",
    subjunctiveStem: "teng",
    imperativeTu: "ten",
  },
  traer: {
    presentYo: "traigo",
    preteriteStem: "traj",
    subjunctiveStem: "traig",
    gerund: "trayendo",
  },
  valer: {
    presentYo: "valgo",
    futureStem: "valdr",
    subjunctiveStem: "valg",
  },
  venir: {
    present: ["vengo", "vienes", "viene", "venimos", "venís", "vienen"],
    preteriteStem: "vin",
    futureStem: "vendr",
    subjunctiveStem: "veng",
    gerund: "viniendo",
    imperativeTu: "ven",
  },
  ver: {
    present: ["veo", "ves", "ve", "vemos", "veis", "ven"],
    preterite: ["vi", "viste", "vio", "vimos", "visteis", "vieron"],
    imperfect: ["veía", "veías", "veía", "veíamos", "veíais", "veían"],
    participle: "visto",
  },
  volver: { stemChange: "o-ue", participle: "vuelto" },
};

const unique = (forms: readonly string[]): string[] =>
  Array.from(new Set(forms.filter(Boolean)));

const getEnding = (verb: string): "ar" | "er" | "ir" =>
  verb.slice(-2) as "ar" | "er" | "ir";

const getStem = (verb: string): string => verb.slice(0, -2);

const replaceLast = (value: string, from: string, to: string): string => {
  const index = value.lastIndexOf(from);
  return index === -1
    ? value
    : `${value.slice(0, index)}${to}${value.slice(index + from.length)}`;
};

const applyStemChange = (stem: string, stemChange?: StemChangeKind): string => {
  switch (stemChange) {
    case "e-ie":
      return replaceLast(stem, "e", "ie");
    case "e-i":
      return replaceLast(stem, "e", "i");
    case "o-ue":
      return replaceLast(stem, "o", "ue");
    case "u-ue":
      return replaceLast(stem, "u", "ue");
    default:
      return stem;
  }
};

const applyReducedIrStemChange = (
  stem: string,
  stemChange?: StemChangeKind,
): string => {
  switch (stemChange) {
    case "e-ie":
    case "e-i":
      return replaceLast(stem, "e", "i");
    case "o-ue":
      return replaceLast(stem, "o", "u");
    default:
      return stem;
  }
};

const applyArBeforeEOrthography = (stem: string): string => {
  if (stem.endsWith("c")) return `${stem.slice(0, -1)}qu`;
  if (stem.endsWith("g")) return `${stem.slice(0, -1)}gu`;
  if (stem.endsWith("z")) return `${stem.slice(0, -1)}c`;
  return stem;
};

const maybeStemChangePresent = (
  stem: string,
  index: number,
  override: VerbOverride,
): string =>
  [0, 1, 2, 5].includes(index)
    ? applyStemChange(stem, override.stemChange)
    : stem;

const generatePresent = (
  verb: SpanishVerbMatchKey,
  override: VerbOverride,
): PersonForms => {
  if (override.present) return override.present;

  const ending = getEnding(verb);
  const stem = getStem(verb);
  const endings =
    ending === "ar"
      ? ["o", "as", "a", "amos", "áis", "an"]
      : ending === "er"
        ? ["o", "es", "e", "emos", "éis", "en"]
        : ["o", "es", "e", "imos", "ís", "en"];
  return endings.map((endingValue, index) => {
    if (index === 0 && override.presentYo) return override.presentYo;
    return `${maybeStemChangePresent(stem, index, override)}${endingValue}`;
  }) as unknown as PersonForms;
};

const getPreteriteYoStem = (stem: string, ending: "ar" | "er" | "ir") =>
  ending === "ar" ? applyArBeforeEOrthography(stem) : stem;

const generatePreterite = (
  verb: SpanishVerbMatchKey,
  override: VerbOverride,
): PersonForms => {
  if (override.preterite) return override.preterite;

  const ending = getEnding(verb);
  const stem = getStem(verb);
  if (override.preteriteStem) {
    const thirdPluralEnding = override.preteriteStem.endsWith("j")
      ? "eron"
      : "ieron";
    const forms: PersonForms = [
      `${override.preteriteStem}e`,
      `${override.preteriteStem}iste`,
      override.preteriteThirdSingular ?? `${override.preteriteStem}o`,
      `${override.preteriteStem}imos`,
      `${override.preteriteStem}isteis`,
      `${override.preteriteStem}${thirdPluralEnding}`,
    ];
    return forms;
  }

  if (ending === "ar") {
    return [
      `${getPreteriteYoStem(stem, ending)}é`,
      `${stem}aste`,
      `${stem}ó`,
      `${stem}amos`,
      `${stem}asteis`,
      `${stem}aron`,
    ];
  }

  return [
    `${stem}í`,
    `${stem}iste`,
    override.preteriteY
      ? `${stem}yó`
      : `${applyReducedIrStemChange(stem, override.stemChange)}ió`,
    `${stem}imos`,
    `${stem}isteis`,
    override.preteriteY
      ? `${stem}yeron`
      : `${applyReducedIrStemChange(stem, override.stemChange)}ieron`,
  ];
};

const generateImperfect = (
  verb: SpanishVerbMatchKey,
  override: VerbOverride,
): PersonForms => {
  if (override.imperfect) return override.imperfect;

  const ending = getEnding(verb);
  const stem = getStem(verb);
  if (ending === "ar") {
    return [
      `${stem}aba`,
      `${stem}abas`,
      `${stem}aba`,
      `${stem}ábamos`,
      `${stem}abais`,
      `${stem}aban`,
    ];
  }

  return [
    `${stem}ía`,
    `${stem}ías`,
    `${stem}ía`,
    `${stem}íamos`,
    `${stem}íais`,
    `${stem}ían`,
  ];
};

const appendEndings = (stem: string, endings: readonly string[]): PersonForms =>
  endings.map((ending) => `${stem}${ending}`) as unknown as PersonForms;

const generateFuture = (verb: SpanishVerbMatchKey, override: VerbOverride) =>
  appendEndings(override.futureStem ?? verb, [
    "é",
    "ás",
    "á",
    "emos",
    "éis",
    "án",
  ]);

const generateConditional = (
  verb: SpanishVerbMatchKey,
  override: VerbOverride,
) =>
  appendEndings(override.futureStem ?? verb, [
    "ía",
    "ías",
    "ía",
    "íamos",
    "íais",
    "ían",
  ]);

const getSubjunctiveStem = (
  verb: SpanishVerbMatchKey,
  override: VerbOverride,
  index: number,
): string => {
  if (override.subjunctiveStem) return override.subjunctiveStem;
  if (override.presentYo?.endsWith("o")) return override.presentYo.slice(0, -1);

  const ending = getEnding(verb);
  const stem = getStem(verb);
  if (ending === "ar") {
    const changedStem = [0, 1, 2, 5].includes(index)
      ? applyStemChange(stem, override.stemChange)
      : stem;
    return applyArBeforeEOrthography(changedStem);
  }

  if (ending === "ir" && [3, 4].includes(index)) {
    return applyReducedIrStemChange(stem, override.stemChange);
  }

  return [0, 1, 2, 5].includes(index)
    ? applyStemChange(stem, override.stemChange)
    : stem;
};

const generateSubjunctive = (
  verb: SpanishVerbMatchKey,
  override: VerbOverride,
): PersonForms => {
  if (override.subjunctive) return override.subjunctive;

  const ending = getEnding(verb);
  const endings =
    ending === "ar"
      ? ["e", "es", "e", "emos", "éis", "en"]
      : ["a", "as", "a", "amos", "áis", "an"];

  return endings.map(
    (endingValue, index) =>
      `${getSubjunctiveStem(verb, override, index)}${endingValue}`,
  ) as unknown as PersonForms;
};

const generateImperfectSubjunctive = (
  preterite: PersonForms,
): PersonForms[] => {
  const base = preterite[5].replace(/ron$/, "");
  return [
    [
      `${base}ra`,
      `${base}ras`,
      `${base}ra`,
      `${base}ramos`,
      `${base}rais`,
      `${base}ran`,
    ],
    [
      `${base}se`,
      `${base}ses`,
      `${base}se`,
      `${base}semos`,
      `${base}seis`,
      `${base}sen`,
    ],
    [
      `${base}re`,
      `${base}res`,
      `${base}re`,
      `${base}remos`,
      `${base}reis`,
      `${base}ren`,
    ],
  ];
};

const generateGerund = (
  verb: SpanishVerbMatchKey,
  override: VerbOverride,
): string => {
  if (override.gerund) return override.gerund;

  const ending = getEnding(verb);
  const stem = getStem(verb);
  if (ending === "ar") return `${stem}ando`;

  const gerundStem =
    ending === "ir"
      ? applyReducedIrStemChange(stem, override.stemChange)
      : stem;
  return `${gerundStem}iendo`;
};

const generateParticiple = (
  verb: SpanishVerbMatchKey,
  override: VerbOverride,
): string => {
  if (override.participle) return override.participle;

  const ending = getEnding(verb);
  const stem = getStem(verb);
  return ending === "ar" ? `${stem}ado` : `${stem}ido`;
};

const withGenderAndNumber = (participle: string): string[] =>
  participle.endsWith("o")
    ? [
        participle,
        `${participle.slice(0, -1)}a`,
        `${participle}s`,
        `${participle.slice(0, -1)}as`,
      ]
    : [participle];

const generateImperatives = (
  verb: SpanishVerbMatchKey,
  override: VerbOverride,
  present: PersonForms,
  subjunctive: PersonForms,
): string[] => {
  const vosotros = `${verb.slice(0, -1)}d`;
  return [
    override.imperativeTu ?? present[2],
    subjunctive[2],
    subjunctive[5],
    vosotros,
  ];
};

const buildVerbForms = (verb: SpanishVerbMatchKey): string[] => {
  const override = VERB_OVERRIDES[verb] ?? {};
  const present = generatePresent(verb, override);
  const preterite = generatePreterite(verb, override);
  const imperfect = generateImperfect(verb, override);
  const future = generateFuture(verb, override);
  const conditional = generateConditional(verb, override);
  const subjunctive = generateSubjunctive(verb, override);
  const imperfectSubjunctives = generateImperfectSubjunctive(preterite);
  const gerund = generateGerund(verb, override);
  const participle = generateParticiple(verb, override);
  const imperatives = generateImperatives(verb, override, present, subjunctive);

  return unique([
    verb,
    ...present,
    ...preterite,
    ...imperfect,
    ...future,
    ...conditional,
    ...subjunctive,
    ...imperfectSubjunctives.flat(),
    gerund,
    ...withGenderAndNumber(participle),
    ...imperatives,
    ...(override.extraForms ?? []),
  ]);
};

export const SPANISH_VERB_CONJUGATIONS = Object.fromEntries(
  SPANISH_VERB_INFINITIVES.map((verb) => [verb, buildVerbForms(verb)]),
) as Record<SpanishVerbMatchKey, string[]>;
