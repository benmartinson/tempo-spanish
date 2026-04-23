import {
  computeMatchedTimedWords,
  findClosestWord,
  splitSegmentsIntoSentences,
} from "./helpers";
import { VocabCacheEntry, SegmentWord } from "../types";

describe("computeMatchedTimedWords", () => {
  it("matches English words to Spanish timings and interpolates unmatched positions", () => {
    const segmentStart = 440.76;
    const segmentEnd = 447.88;

    const words = [
      "...As",
      "I",
      "had",
      "said",
      "before,",
      "the",
      "floor",
      "rises",
      "and",
      "the",
      "shower",
      "tray",
      "appears",
      "and",
      "the",
      "toilet",
      "is",
      "under",
      "the",
      "sink...",
    ];

    const wordsToTranslate: SegmentWord[] = [
      { word: "como", start: 440.76, end: 440.9, frequency: 0 },
      { word: "había", start: 441.08, end: 441.28, frequency: 0 },
      { word: "dicho", start: 441.42, end: 441.52, frequency: 0 },
      { word: "antes,", start: 441.52, end: 441.88, frequency: 0 },
      { word: "suelo", start: 442.28, end: 442.44, frequency: 0 },
      { word: "levanta", start: 442.62, end: 443.14, frequency: 0 },
      { word: "aparece", start: 443.34, end: 443.72, frequency: 0 },
      { word: "plato", start: 443.96, end: 444.14, frequency: 0 },
      { word: "ducha", start: 444.32, end: 444.6, frequency: 0 },
      { word: "retrete", start: 445.42, end: 445.88, frequency: 0 },
      { word: "está", start: 445.88, end: 446.4, frequency: 0 },
      { word: "debajo", start: 446.4, end: 447.12, frequency: 0 },
      { word: "del", start: 447.12, end: 447.36, frequency: 0 },
      { word: "fregadero,.", start: 447.36, end: 447.88, frequency: 0 },
    ];

    const vocabCache: VocabCacheEntry[] = [
      { word: "como", translation: "as", alternateMeanings: [] },
      { word: "había", translation: "had", alternateMeanings: [] },
      { word: "dicho", translation: "said", alternateMeanings: [] },
      { word: "antes,", translation: "before", alternateMeanings: [] },
      { word: "suelo", translation: "floor", alternateMeanings: [] },
      { word: "levanta", translation: "rises", alternateMeanings: [] },
      { word: "aparece", translation: "appears", alternateMeanings: [] },
      { word: "plato", translation: "tray", alternateMeanings: [] },
      { word: "ducha", translation: "shower", alternateMeanings: [] },
      { word: "retrete", translation: "toilet", alternateMeanings: [] },
      { word: "está", translation: "is", alternateMeanings: [] },
      { word: "debajo", translation: "under", alternateMeanings: [] },
      { word: "del", translation: "of the", alternateMeanings: [] },
      { word: "fregadero,.", translation: "sink", alternateMeanings: [] },
    ];

    const result = computeMatchedTimedWords({
      words,
      wordsToTranslate,
      vocabCache,
      segmentStart,
      segmentEnd,
    });

    expect(result).not.toBeNull();
    expect(result!.length).toBe(words.length);

    // Result must be monotonic non-decreasing (LIS + safety net guarantees this)
    for (let i = 1; i < result!.length; i++) {
      expect(result![i].start).toBeGreaterThanOrEqual(result![i - 1].start);
    }

    const byWord = (w: string) => result!.find((r) => r.word === w)!;

    // Segment boundaries
    expect(result![0].start).toBe(440.76); // "...As" ← como
    expect(byWord("sink...").start).toBe(447.36); // ← fregadero

    // Words whose matches survive LIS (in monotonic order):
    // they inherit their Spanish word's timing.
    expect(byWord("had").start).toBe(441.08);
    expect(byWord("floor").start).toBe(442.28);
    expect(byWord("rises").start).toBe(442.62);
    expect(byWord("shower").start).toBe(444.32);
    expect(byWord("toilet").start).toBe(445.42);
    expect(byWord("under").start).toBe(446.4);
  });

  it("returns null when no matches can be made", () => {
    const result = computeMatchedTimedWords({
      words: ["hello", "world"],
      wordsToTranslate: [],
      vocabCache: [],
      segmentStart: 0,
      segmentEnd: 5,
    });
    expect(result).toBeNull();
  });

  it("returns null when duration is invalid", () => {
    const result = computeMatchedTimedWords({
      words: ["hello"],
      wordsToTranslate: [{ word: "hola", start: 0, end: 1, frequency: 0 }],
      vocabCache: [
        { word: "hola", translation: "hello", alternateMeanings: [] },
      ],
      segmentStart: 5,
      segmentEnd: 5,
    });
    expect(result).toBeNull();
  });

  it("matches a longer translated sentence with reordering and repeated content words", () => {
    const segmentStart = 345.38;
    const segmentEnd = 355.4;

    const words = [
      "But",
      "I",
      "was",
      "very",
      "smart",
      "and",
      "included",
      "this",
      "little",
      "thing",
      "here",
      "that",
      "is",
      "a",
      "countertop,",
      "it",
      "is",
      "an",
      "extension",
      "of",
      "the",
      "countertop",
      "so",
      "that",
      "I",
      "can",
      "have",
      "more",
      "space",
      "to",
      "work.",
    ];

    const wordsToTranslate: SegmentWord[] = [
      { word: "Pero", start: 345.38, end: 345.5, frequency: 0 },
      { word: "fui", start: 345.5, end: 346.12, frequency: 0 },
      { word: "lista", start: 346.32, end: 346.68, frequency: 0 },
      { word: "e", start: 346.94, end: 347.06, frequency: 0 },
      { word: "incluí", start: 347.06, end: 347.44, frequency: 0 },
      { word: "cosita", start: 347.68, end: 348.04, frequency: 0 },
      { word: "aquí", start: 348.18, end: 348.42, frequency: 0 },
      { word: "es", start: 349.64, end: 349.88, frequency: 0 },
      { word: "encimera,", start: 350.14, end: 350.64, frequency: 0 },
      { word: "extensión", start: 351.24, end: 351.8, frequency: 0 },
      { word: "poder", start: 353.04, end: 353.36, frequency: 0 },
      { word: "tener", start: 353.36, end: 353.68, frequency: 0 },
      { word: "más", start: 353.68, end: 354.02, frequency: 0 },
      { word: "espacio", start: 354.24, end: 354.52, frequency: 0 },
      { word: "donde", start: 354.52, end: 355.04, frequency: 0 },
      { word: "trabajar.", start: 355.04, end: 355.4, frequency: 0 },
    ];

    // vocabCache reflects the actual runtime translations from the app
    // (some words like "smart", "little", "can" aren't matched because their
    // Spanish translations don't contain those exact English words).
    const vocabCache: VocabCacheEntry[] = [
      { word: "Pero", translation: "But", alternateMeanings: [] },
      { word: "fui", translation: "was", alternateMeanings: [] },
      { word: "lista", translation: "ready", alternateMeanings: [] },
      { word: "e", translation: "and", alternateMeanings: [] },
      { word: "incluí", translation: "included", alternateMeanings: [] },
      { word: "cosita", translation: "thing", alternateMeanings: [] },
      { word: "aquí", translation: "here", alternateMeanings: [] },
      { word: "es", translation: "is", alternateMeanings: [] },
      { word: "encimera,", translation: "countertop", alternateMeanings: [] },
      { word: "extensión", translation: "extension", alternateMeanings: [] },
      { word: "poder", translation: "able", alternateMeanings: [] },
      { word: "tener", translation: "have", alternateMeanings: [] },
      { word: "más", translation: "more", alternateMeanings: [] },
      { word: "espacio", translation: "space", alternateMeanings: [] },
      { word: "donde", translation: "where", alternateMeanings: [] },
      { word: "trabajar.", translation: "work", alternateMeanings: [] },
    ];

    const result = computeMatchedTimedWords({
      words,
      wordsToTranslate,
      vocabCache,
      segmentStart,
      segmentEnd,
    });

    expect(result).not.toBeNull();
    expect(result!.length).toBe(words.length);

    // Result must be monotonic non-decreasing
    for (let i = 1; i < result!.length; i++) {
      expect(result![i].start).toBeGreaterThanOrEqual(result![i - 1].start);
    }

    // Exact per-word values produced by the current algorithm
    expect(result).toEqual([
      { word: "But", start: 345.38, end: 345.5 },
      { word: "I", start: 345.44, end: 345.44 },
      { word: "was", start: 345.5, end: 346.12 },
      { word: "very", start: 345.98, end: 345.98 },
      { word: "smart", start: 346.46, end: 346.46 },
      { word: "and", start: 346.94, end: 347.06 },
      { word: "included", start: 347.06, end: 347.44 },
      { word: "this", start: 347.26666666666665, end: 347.26666666666665 },
      { word: "little", start: 347.47333333333336, end: 347.47333333333336 },
      { word: "thing", start: 347.68, end: 348.04 },
      { word: "here", start: 348.18, end: 348.42 },
      { word: "that", start: 348.90999999999997, end: 348.90999999999997 },
      { word: "is", start: 349.64, end: 349.88 },
      { word: "a", start: 349.89, end: 349.89 },
      { word: "countertop,", start: 350.14, end: 350.64 },
      { word: "it", start: 350.41499999999996, end: 350.41499999999996 },
      { word: "is", start: 350.69, end: 350.69 },
      { word: "an", start: 350.96500000000003, end: 350.96500000000003 },
      { word: "extension", start: 351.24, end: 351.8 },
      { word: "of", start: 351.505, end: 351.505 },
      { word: "the", start: 351.77, end: 351.77 },
      { word: "countertop", start: 352.035, end: 352.035 },
      { word: "so", start: 352.3, end: 352.3 },
      { word: "that", start: 352.565, end: 352.565 },
      { word: "I", start: 352.83000000000004, end: 352.83000000000004 },
      { word: "can", start: 353.095, end: 353.095 },
      { word: "have", start: 353.36, end: 353.68 },
      { word: "more", start: 353.68, end: 354.02 },
      { word: "space", start: 354.24, end: 354.52 },
      { word: "to", start: 354.64, end: 354.64 },
      { word: "work.", start: 355.04, end: 355.4 },
    ]);
  });

  it("supports multiple cache entries per Spanish word (multiple translations)", () => {
    // "para" has two translations: "for" and "so". Both should match.
    // First sentence uses "so", second uses "for".
    const wordsToTranslate: SegmentWord[] = [
      { word: "hola", start: 0, end: 1, frequency: 0 },
      { word: "para", start: 1, end: 2, frequency: 0 },
      { word: "ti", start: 2, end: 3, frequency: 0 },
    ];
    const vocabCache: VocabCacheEntry[] = [
      { word: "hola", translation: "hello", alternateMeanings: [] },
      { word: "para", translation: "for", alternateMeanings: [] },
      { word: "para", translation: "so", alternateMeanings: [] },
      { word: "ti", translation: "you", alternateMeanings: [] },
    ];

    // Sentence that uses "so" variant
    const resultSo = computeMatchedTimedWords({
      words: ["hello", "so", "you"],
      wordsToTranslate,
      vocabCache,
      segmentStart: 0,
      segmentEnd: 3,
    });
    expect(resultSo).toEqual([
      { word: "hello", start: 0, end: 1 },
      { word: "so", start: 1, end: 2 },
      { word: "you", start: 2, end: 3 },
    ]);

    // Sentence that uses "for" variant — still anchors "para" to the same time
    const resultFor = computeMatchedTimedWords({
      words: ["hello", "for", "you"],
      wordsToTranslate,
      vocabCache,
      segmentStart: 0,
      segmentEnd: 3,
    });
    expect(resultFor).toEqual([
      { word: "hello", start: 0, end: 1 },
      { word: "for", start: 1, end: 2 },
      { word: "you", start: 2, end: 3 },
    ]);
  });

  it("handles multi-word translations by mapping each piece to the same Spanish time", () => {
    const result = computeMatchedTimedWords({
      words: ["I", "have", "clean", "water"],
      wordsToTranslate: [
        { word: "tengo", start: 2, end: 2, frequency: 0 },
        { word: "agua", start: 3, end: 3, frequency: 0 },
        { word: "limpia", start: 4, end: 4, frequency: 0 },
      ],
      vocabCache: [
        { word: "tengo", translation: "I have", alternateMeanings: [] },
        { word: "agua", translation: "water", alternateMeanings: [] },
        { word: "limpia", translation: "clean", alternateMeanings: [] },
      ],
      segmentStart: 2,
      segmentEnd: 5,
    });

    // Monotonic enforcement: "water" would get time 3 from its match, but
    // that's earlier than "clean" at 4. LIS drops "water"; it gets interpolated
    // from its prev neighbor's end (clean → 4).
    expect(result).toEqual([
      { word: "I", start: 2, end: 2 },
      { word: "have", start: 2, end: 2 },
      { word: "clean", start: 4, end: 4 },
      { word: "water", start: 4, end: 4 },
    ]);
  });
});

describe("splitSegmentsIntoSentences", () => {
  it("splits a segment with mixed punctuation into sentences", () => {
    const rawWords = [
      "Por,",
      "lo,",
      "tanto,",
      "Michael",
      "se",
      "pone",
      "a",
      "investigar",
      "decenas",
      "de",
      "miles",
      "de",
      "hipotecas",
      "que",
      "están",
      "dentro",
      "de",
      "un",
      "instrumento",
      "de",
      "inversión",
      "llamado",
      "bono",
      "hipotecario,.",
      "el",
      "cual",
      "contiene",
      "hipotecas",
      "de",
      "miles",
      "de",
      "personas,",
      "aunque",
      "eso",
      "te",
      "lo",
      "explicaré",
      "mejor",
      "en",
      "un",
      "momento,.",
      "y",
      "lo",
      "que",
      "encuentra",
      "después",
      "de",
      "examinar",
      "estas",
      "avalanchas",
      "de",
      "números",
      "en",
      "pantalla",
      "es",
      "alarmante.,",
      "El",
      "Dr.",
      "Michael",
      "Burry",
      "concluye",
      "que",
      "el",
      "sistema",
      "y",
      "todo",
      "el",
      "mercado",
      "inmobiliario",
      "está",
      "al",
      "borde",
      "del",
      "colapso.",
    ];

    const words = rawWords.map((w, i) => ({
      word: ` ${w}`,
      start: 110.68 + i * 0.27,
      end: 110.68 + (i + 1) * 0.27,
      frequency: 0,
    }));

    const segments = [
      {
        segment_id: 7,
        start: 110.68,
        end: 131.02,
        text: rawWords.join("  "),
        video_id: "808",
        words,
      },
    ] as any;

    const result = splitSegmentsIntoSentences(segments);

    expect(result).toHaveLength(4);
    expect(result.map((s) => s.index)).toEqual([0, 1, 2, 3]);
    expect(result.map((s) => s.text)).toEqual([
      "Por, lo, tanto, Michael se pone a investigar decenas de miles de hipotecas que están dentro de un instrumento de inversión llamado bono hipotecario,.",
      "el cual contiene hipotecas de miles de personas, aunque eso te lo explicaré mejor en un momento,.",
      "y lo que encuentra después de examinar estas avalanchas de números en pantalla es alarmante.,",
      "El Dr. Michael Burry concluye que el sistema y todo el mercado inmobiliario está al borde del colapso.",
    ]);
  });

  it("splits on a regular word ending in a period (not an abbreviation)", () => {
    const rawWords = [
      "Por,",
      "lo,",
      "tanto,",
      "Michael",
      "se",
      "pone",
      "a",
      "investigar",
      "decenas",
      "de",
      "miles",
      "de",
      "hipotecas",
      "que",
      "están",
      "dentro",
      "de",
      "un",
      "instrumento",
      "de",
      "inversión",
      "llamado",
      "bono",
      "hipotecario,.",
      "el",
      "cual",
      "contiene",
      "hipotecas",
      "de",
      "miles",
      "de",
      "personas,",
      "aunque",
      "eso",
      "te",
      "lo",
      "explicaré",
      "mejor",
      "en",
      "un",
      "momento,.",
      "y",
      "lo",
      "que",
      "encuentra",
      "después",
      "de",
      "examinar",
      "estas",
      "avalanchas",
      "de",
      "números",
      "en",
      "pantalla",
      "es",
      "alarmante.,",
      "El",
      "peor.",
      "Michael",
      "Burry",
      "concluye",
      "que",
      "el",
      "sistema",
      "y",
      "todo",
      "el",
      "mercado",
      "inmobiliario",
      "está",
      "al",
      "borde",
      "del",
      "colapso.",
    ];

    const words = rawWords.map((w, i) => ({
      word: ` ${w}`,
      start: 110.68 + i * 0.27,
      end: 110.68 + (i + 1) * 0.27,
      frequency: 0,
    }));

    const segments = [
      {
        segment_id: 7,
        start: 110.68,
        end: 131.02,
        text: rawWords.join("  "),
        video_id: "808",
        words,
      },
    ] as any;

    const result = splitSegmentsIntoSentences(segments);

    expect(result).toHaveLength(4);
    expect(result.map((s) => s.index)).toEqual([0, 1, 2, 3]);
    expect(result.map((s) => s.text)).toEqual([
      "Por, lo, tanto, Michael se pone a investigar decenas de miles de hipotecas que están dentro de un instrumento de inversión llamado bono hipotecario,.",
      "el cual contiene hipotecas de miles de personas, aunque eso te lo explicaré mejor en un momento,.",
      "y lo que encuentra después de examinar estas avalanchas de números en pantalla es alarmante., El peor.",
      "Michael Burry concluye que el sistema y todo el mercado inmobiliario está al borde del colapso.",
    ]);
  });
});

describe("findClosestWord", () => {
  it("returns the exact match when spoken word matches a word in the list", () => {
    const words = [
      { word: "Cuando" },
      { word: "reaparecio" },
      { word: "necesario" },
      { word: "necesario" },
    ] as any;

    const result = findClosestWord("ceseri", words);

    expect(result).toEqual({ word: "necesario" });
  });
});
