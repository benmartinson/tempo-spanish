import {
  computeBaseMaskedIndices,
  findClosestWord,
  splitSegmentsIntoSentences,
} from "./helpers";

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
    ];

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
    ];

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

  it("merges punctuation-split number continuations before sentence splitting", () => {
    const rawWords = [
      "Cuesta",
      "3",
      ".14",
      "millones",
      "y",
      "1",
      ",000",
      "o",
      "$1",
      ",000",
      "personas.",
    ];

    const words = rawWords.map((w, i) => ({
      word: ` ${w}`,
      start: i,
      end: i + 1,
      frequency: 0,
    }));

    const result = splitSegmentsIntoSentences([
      {
        segment_id: 1,
        start: 0,
        end: rawWords.length,
        text: rawWords.join(" "),
        video_id: "1",
        words,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(
      "Cuesta 3.14 millones y 1,000 o $1,000 personas.",
    );
    expect(result[0].words.map((word) => word.word)).toEqual([
      " Cuesta",
      " 3.14",
      " millones",
      " y",
      " 1,000",
      " o",
      " $1,000",
      " personas.",
    ]);
  });

  it("does not merge comma or period continuations onto non-number words", () => {
    const rawWords = ["Hola", ",amigo", "termina."];
    const words = rawWords.map((w, i) => ({
      word: ` ${w}`,
      start: i,
      end: i + 1,
      frequency: 0,
    }));

    const result = splitSegmentsIntoSentences([
      {
        segment_id: 1,
        start: 0,
        end: rawWords.length,
        text: rawWords.join(" "),
        video_id: "1",
        words,
      },
    ]);

    expect(result[0].words.map((word) => word.word)).toEqual([
      " Hola",
      " ,amigo",
      " termina.",
    ]);
  });
});

describe("computeBaseMaskedIndices", () => {
  // "Y otro problema con la titulitis es que tambien devalua la educacion.
  //  El aprendizaje se convierte en una carrera por el diploma."
  // Indices:
  //  0:Y       1:otro       2:problema    3:con    4:la       5:titulitis
  //  6:es      7:que        8:tambien     9:devalua 10:la     11:educacion.
  //  12:El     13:aprendizaje 14:se       15:convierte 16:en  17:una
  //  18:carrera 19:por      20:el         21:diploma.
  const text =
    "Y otro problema con la titulitis es que tambien devalua la educacion. El aprendizaje se convierte en una carrera por el diploma.";
  const words = text.split(/\s+/).map((w, i) => ({
    word: w,
    start: i,
    end: i + 1,
    frequency: 0,
  }));

  const indicesAt = (difficulty) =>
    [...computeBaseMaskedIndices(words, difficulty)].sort((a, b) => a - b);

  it("masks nothing at difficulty 0", () => {
    expect(indicesAt(0)).toEqual([]);
  });

  it("masks easy words (prepositions/pronouns) at difficulty 1", () => {
    expect(indicesAt(1)).toEqual([0, 1, 3, 4, 7, 10, 12, 14, 16, 17, 19, 20]);
  });

  it("masks all easy words plus 1/3 of the rest at difficulty 2", () => {
    // 12 easy words + ceil(10/3) = 4 evenly-spaced rest words
    expect(indicesAt(2)).toEqual([
      0, 1, 2, 3, 4, 6, 7, 10, 11, 12, 14, 15, 16, 17, 19, 20,
    ]);
  });

  it("masks all easy words plus 2/3 of the rest at difficulty 3", () => {
    // 12 easy words + ceil(20/3) = 7 evenly-spaced rest words
    expect(indicesAt(3)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20,
    ]);
    expect(indicesAt(3).length).toBeGreaterThan(indicesAt(2).length);
  });

  it("masks every word at difficulty 4", () => {
    expect(indicesAt(4)).toEqual(words.map((_, i) => i));
  });

  describe("with one non-easy word", () => {
    // "Yo lo veo." → Yo (pronoun), lo (pronoun), veo. (rest)
    const wordsOne = "Yo lo veo.".split(/\s+/).map((w, i) => ({
      word: w,
      start: i,
      end: i + 1,
      frequency: 0,
    }));
    const at = (d) =>
      [...computeBaseMaskedIndices(wordsOne, d)].sort((a, b) => a - b);

    it("masks the same set at difficulties 2, 3, and 4", () => {
      const all = [0, 1, 2];
      expect(at(1)).toEqual([0, 1]);
      expect(at(2)).toEqual(all);
      expect(at(3)).toEqual(all);
      expect(at(4)).toEqual(all);
    });
  });

  describe("with two non-easy words", () => {
    // "Yo lo veo el carro." → Yo, lo, veo, el, carro.
    // easy: 0 (Yo), 1 (lo), 3 (el); rest: 2 (veo), 4 (carro.)
    const wordsTwo = "Yo lo veo el carro.".split(/\s+/).map((w, i) => ({
      word: w,
      start: i,
      end: i + 1,
      frequency: 0,
    }));
    const at = (d) =>
      [...computeBaseMaskedIndices(wordsTwo, d)].sort((a, b) => a - b);

    it("masks one rest word at difficulty 2 and both at difficulties 3 and 4", () => {
      expect(at(1)).toEqual([0, 1, 3]);
      expect(at(2)).toEqual([0, 1, 2, 3]);
      const all = [0, 1, 2, 3, 4];
      expect(at(3)).toEqual(all);
      expect(at(4)).toEqual(all);
    });
  });
});

describe("findClosestWord", () => {
  it("returns the exact match when spoken word matches a word in the list", () => {
    const words = [
      { word: "Cuando" },
      { word: "reaparecio" },
      { word: "necesario" },
      { word: "necesario" },
    ];

    const result = findClosestWord("ceseri", words);

    expect(result).toEqual({ word: "necesario" });
  });
});
