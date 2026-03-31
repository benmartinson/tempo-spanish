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
          _matchScore: 0.5,
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
          _matchScore: 0.5,
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
      percentage: 35,
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
          _spokenIndex: 2,
          _matchScore: 0.5,
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
      percentage: 38,
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

    // Check proper nouns matched
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
