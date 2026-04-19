import { calculateAccuracy } from "./calculate_accuracy";

describe("calculateAccuracy", () => {
  it("returns correct acc result", () => {
    const result = calculateAccuracy(
      ["te", "vuelto", "a", "presente"],
      ["De", "vuelta", "al", "presente,", "un", "general", "informa", "a"],
      [],
    );

    const expectedResult = {
      details: [
        {
          _matchScore: 0.6,
          _spokenIndex: 0,
          isProperNoun: false,
          matched: true,
          spokenWord: "te",
          targetWord: "De",
        },
        {
          _matchScore: 0.8333333333333334,
          _spokenIndex: 1,
          isProperNoun: false,
          matched: true,
          spokenWord: "vuelto",
          targetWord: "vuelta",
        },
        {
          _matchScore: 0.6,
          _spokenIndex: 2,
          isProperNoun: false,
          matched: true,
          spokenWord: "a",
          targetWord: "al",
        },
        {
          _matchScore: 1,
          _spokenIndex: 3,
          isProperNoun: false,
          matched: true,
          spokenWord: "presente,",
          targetWord: "presente,",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "un",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "general",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "informa",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "a",
        },
      ],
      matchedWords: 4,
      percentage: 37,
      totalWords: 8,
    };

    expect(result).toEqual(expectedResult);
  });
});

describe("calculateAccuracy - last 4 words sequence", () => {
  it("picks the best matching subsequence at the end of the target array", () => {
    const target = [
      "De",
      "vuelta",
      "al",
      "presente,",
      "un",
      "te",
      "vuelto",
      "al",
      "presente",
    ];
    const spoken = ["te", "vuelto", "a", "presente"];

    const result = calculateAccuracy(spoken, target, []);

    const expectedResult = {
      details: [
        { targetWord: "De", matched: false, isProperNoun: false },
        { targetWord: "vuelta", matched: false, isProperNoun: false },
        { targetWord: "al", matched: false, isProperNoun: false },
        { targetWord: "presente,", matched: false, isProperNoun: false },
        { targetWord: "un", matched: false, isProperNoun: false },
        {
          targetWord: "te",
          spokenWord: "te",
          matched: true,
          isProperNoun: false,
          _spokenIndex: 0,
          _matchScore: 1,
        },
        {
          targetWord: "vuelto",
          spokenWord: "vuelto",
          matched: true,
          isProperNoun: false,
          _spokenIndex: 1,
          _matchScore: 1,
        },
        {
          targetWord: "al",
          spokenWord: "a",
          matched: true,
          isProperNoun: false,
          _matchScore: 0.6,
          _spokenIndex: 2,
        },
        {
          targetWord: "presente",
          spokenWord: "presente",
          matched: true,
          isProperNoun: false,
          _spokenIndex: 3,
          _matchScore: 1,
        },
      ],
      matchedWords: 4,
      totalWords: 9,
      percentage: 40,
    };

    expect(result).toEqual(expectedResult);
  });
});

describe("calculateAccuracy - later perfect sequence", () => {
  it("matches the later perfect contiguous sequence", () => {
    const targetWords = [
      "te",
      "vuelto",
      "fue",
      "a",
      "presente",
      "un",
      "te",
      "vuelto",
      "a",
      "presente",
    ];
    const spokenWords = ["te", "vuelto", "a", "presente"];

    const result = calculateAccuracy(spokenWords, targetWords, []);

    // Expect it to match the later contiguous perfect sequence: [6,7,8,9]
    const expectedResult = {
      details: [
        { targetWord: "te", matched: false, isProperNoun: false },
        { targetWord: "vuelto", matched: false, isProperNoun: false },
        { targetWord: "fue", matched: false, isProperNoun: false },
        { targetWord: "a", matched: false, isProperNoun: false },
        { targetWord: "presente", matched: false, isProperNoun: false },
        { targetWord: "un", matched: false, isProperNoun: false },
        {
          targetWord: "te",
          spokenWord: "te",
          matched: true,
          isProperNoun: false,
          _spokenIndex: 0,
          _matchScore: 1,
        },
        {
          targetWord: "vuelto",
          spokenWord: "vuelto",
          matched: true,
          isProperNoun: false,
          _spokenIndex: 1,
          _matchScore: 1,
        },
        {
          targetWord: "a",
          spokenWord: "a",
          matched: true,
          isProperNoun: false,
          _spokenIndex: 2,
          _matchScore: 1,
        },
        {
          targetWord: "presente",
          spokenWord: "presente",
          matched: true,
          isProperNoun: false,
          _spokenIndex: 3,
          _matchScore: 1,
        },
      ],
      matchedWords: 4,
      totalWords: 10,
      percentage: 40,
    };

    expect(result).toEqual(expectedResult);
  });
});

describe("calculateAccuracy - mostly unrelated spoken words with proper nouns", () => {
  it("should only match sugiere and puden besides proper nouns", () => {
    const spokenWords = [
      "Eh,",
      "¿cuántos",
      "sugieren",
      "que",
      "pueden?",
      "¿Deberían",
      "preguntar",
      "por",
      "ayuda?",
    ];
    const targetWords = [
      "Aragorn",
      "sugiere",
      "pedir",
      "ayuda,",
      "pero",
      "Theoden",
      "responde",
      "que",
      "no",
      "pueden",
      "contar",
      "con",
      "nadie,",
      "ni",
      "siquiera",
      "con",
      "Gondor.",
    ];
    const properNouns = ["Aragorn", "Theoden", "Gondor"];

    const result = calculateAccuracy(spokenWords, targetWords, properNouns);

    expect(result).toEqual({
      details: [
        {
          _matchScore: 1,
          _spokenIndex: 0,
          isProperNoun: true,
          matched: true,
          spokenWord: "Aragorn",
          targetWord: "Aragorn",
        },
        {
          _matchScore: 0.875,
          _spokenIndex: 2,
          isProperNoun: false,
          matched: true,
          spokenWord: "sugieren",
          targetWord: "sugiere",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "pedir",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "ayuda,",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "pero",
        },
        {
          _matchScore: 1,
          _spokenIndex: 1,
          isProperNoun: true,
          matched: true,
          spokenWord: "Theoden",
          targetWord: "Theoden",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "responde",
        },
        {
          _matchScore: 1,
          _spokenIndex: 3,
          isProperNoun: false,
          matched: true,
          spokenWord: "que",
          targetWord: "que",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "no",
        },
        {
          _matchScore: 1,
          _spokenIndex: 4,
          isProperNoun: false,
          matched: true,
          spokenWord: "pueden",
          targetWord: "pueden",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "contar",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "con",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "nadie,",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "ni",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "siquiera",
        },
        {
          isProperNoun: false,
          matched: false,
          targetWord: "con",
        },
        {
          _matchScore: 1,
          _spokenIndex: 5,
          isProperNoun: true,
          matched: true,
          spokenWord: "Gondor.",
          targetWord: "Gondor.",
        },
      ],
      matchedWords: 6,
      percentage: 34,
      totalWords: 17,
    });
  });
});

describe("calculateAccuracy - proper nouns auto-match", () => {
  it("matches proper nouns and regular words correctly", () => {
    const properNouns = ["Legolas", "Aragorn"];
    const spokenWords = [
      "Luego",
      "él",
      "dice",
      "que",
      "no",
      "pueden",
      "ganar",
      "la",
      "batalla,",
      "que",
      "todos",
      "morirán.",
      "Y",
      "Aragorn",
      "responde",
      "con",
      "firmeza",
      "que",
      "si",
      "no",
      "es",
      "así,",
      "él",
      "morirá",
      "junto",
      "a",
      "ellos.",
    ];
    const targetWords = [
      "Legolas",
      "dice",
      "que",
      "no",
      "pueden",
      "ganar",
      "la",
      "batalla,",
      "que",
      "todos",
      "morirán.,",
      "Aragorn",
      "responde",
      "con",
      "firmeza",
      "que",
      "si",
      "es",
      "así,",
      "él",
      "morirá",
      "junto",
      "a",
      "ellos.",
    ];

    const result = calculateAccuracy(spokenWords, targetWords, properNouns);

    // // Check proper nouns matched
    const legolasMatch = result.details.find((d) => d.targetWord === "Legolas");
    expect(legolasMatch?.matched).toBe(true);
    expect(legolasMatch?.spokenWord).toBe("Legolas");

    const aragornMatch = result.details.find((d) => d.targetWord === "Aragorn");
    expect(aragornMatch?.matched).toBe(true);
    expect(aragornMatch?.spokenWord).toBe("Aragorn");

    // Check some regular words matched
    const diceMatch = result.details.find((d) => d.targetWord === "dice");
    expect(diceMatch?.matched).toBe(true);
    expect(diceMatch?.spokenWord).toBe("dice");

    const batallaMatch = result.details.find(
      (d) => d.targetWord === "batalla,",
    );
    expect(batallaMatch?.matched).toBe(true);
    expect(batallaMatch?.spokenWord).toBe("batalla,");

    // Total matched words should include proper nouns
    expect(result.matchedWords).toEqual(24);

    // Percentage should be > 0
    expect(result.percentage).toEqual(100);
  });
});

describe("calculateAccuracy - skipped words with proper noun and near-matches", () => {
  it("should return 100% when spoken words cover all target words allowing for proper noun skips and diaretics", () => {
    const spokenWords = [
      "Y",
      "luego",
      "se",
      "despierta,",
      "al",
      "final,",
      "da",
      "el",
      "acepto",
      "la",
      "realidad",
      "de",
      "que",
      "debía",
      "retirarse.",
    ];
    const targetWords = [
      "Y",
      "luego",
      "se",
      "despierta.,",
      "Al",
      "final",
      "Bell",
      "aceptó",
      "la",
      "realidad",
      "de",
      "que",
      "debía",
      "retirarse.",
    ];
    const properNouns = ["Bell"];

    const result = calculateAccuracy(spokenWords, targetWords, properNouns);

    // Every target word should be matched
    result.details.forEach((detail) => {
      expect(detail.matched).toBe(true);
    });

    // All matched, no spelling errors
    expect(result.percentage).toEqual(100);
    expect(result.matchedWords).toEqual(targetWords.length);
  });
});

describe("calculateAccuracy - strips quotes from spoken words", () => {
  it("should remove quote characters from spokenWord in results", () => {
    const spokenWords = [
      "Esto", "es", "por", "tratar", "con", "los", "ejemplos:",
      '"No', "te", "falte", "que", "te", '"quedes"', "con", "el", "nombre.",
    ];
    const targetWords = [
      "Esto", "es", "por", "tratar", "con", "los", "ejemplos,",
      "no", "te", "falta", "que", "te", "quedes", "con", "el", "nombre.",
    ];

    const result = calculateAccuracy(spokenWords, targetWords, []);

    // '"quedes"' with quotes stripped should be a perfect match to target "quedes"
    const quedesMatch = result.details.find((d) => d.targetWord === "quedes");
    expect(quedesMatch?.matched).toBe(true);
    expect(quedesMatch?.spokenWord).toBe("quedes");
    expect(quedesMatch?._matchScore).toBe(1);

    // '"No' with quote stripped should be a perfect match to target "no"
    const noMatch = result.details.find((d) => d.targetWord === "no");
    expect(noMatch?.matched).toBe(true);
    expect(noMatch?.spokenWord).toBe("no");
    expect(noMatch?._matchScore).toBe(1);
  });
});

describe("calculateAccuracy - number word normalization", () => {
  it("should match spoken number words to digit equivalents", () => {
    const spokenWords = [
      "Mientras",
      "pide",
      "una",
      "camisa",
      "a",
      "uno,",
      "ofreciéndole",
      "100",
      "dólares",
      "y",
      "cincuenta",
      "se",
      "hace",
      "un",
      "cabestrillo.",
    ];
    const targetWords = [
      "Anton",
      "pide",
      "una",
      "camisa",
      "a",
      "uno,",
      "ofreciéndole",
      "cien",
      "dólares",
      "y",
      "50",
      "se",
      "hace",
      "un",
      "cabestrillo.",
    ];
    const properNouns = ["Anton"];

    const result = calculateAccuracy(spokenWords, targetWords, properNouns);

    // Every target word should be matched
    result.details.forEach((detail) => {
      expect(detail.matched).toBe(true);
    });

    expect(result.percentage).toEqual(100);
    expect(result.matchedWords).toEqual(targetWords.length);
  });
});
