import { findClosestWord, splitSegmentsIntoSentences } from "./helpers";

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
