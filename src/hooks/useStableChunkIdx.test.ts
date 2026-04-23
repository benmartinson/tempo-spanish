import {
  findWordIdxAtTime,
  computeChunkTimes,
  findActiveChunkIdxAtTime,
} from "./useStableChunkIdx";

describe("findWordIdxAtTime", () => {
  it("returns the word whose range contains the time (monotonic)", () => {
    const words = [
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
    ];
    expect(findWordIdxAtTime(words, 0.5)).toBe(0);
    expect(findWordIdxAtTime(words, 1.5)).toBe(1);
    expect(findWordIdxAtTime(words, 2.5)).toBe(2);
  });

  it("returns closest word by midpoint when time is outside any range", () => {
    const words = [
      { start: 0, end: 1 },
      { start: 3, end: 4 },
    ];
    // t=2: midpoints are 0.5 and 3.5, equidistant → first wins
    expect(findWordIdxAtTime(words, 2)).toBe(0);
    // t=1.5 is closer to midpoint of word 0 (0.5, dist 1) than word 1 (3.5, dist 2)
    expect(findWordIdxAtTime(words, 1.5)).toBe(0);
    // t=2.5 is closer to midpoint of word 1 (3.5, dist 1) than word 0 (0.5, dist 2)
    expect(findWordIdxAtTime(words, 2.5)).toBe(1);
  });

  it("handles non-monotonic timings correctly", () => {
    // This mirrors the bug in TranslateContent: "the" at idx 5 matched to a
    // late Spanish word (t=447.12), while "floor" at idx 6 is early (t=442.28).
    // At t=442.3 the result should be "floor" (idx 6), NOT stuck at idx 4.
    const words = [
      { start: 440.76, end: 440.76 }, // ...As
      { start: 440.92, end: 440.92 }, // I
      { start: 441.08, end: 441.08 }, // had
      { start: 441.42, end: 441.42 }, // said
      { start: 441.52, end: 441.88 }, // before,
      { start: 447.12, end: 447.12 }, // the (matched to "del" at end of sentence)
      { start: 442.28, end: 442.44 }, // floor
      { start: 442.62, end: 443.14 }, // rises
    ];

    expect(findWordIdxAtTime(words, 442.3)).toBe(6); // "floor"
    expect(findWordIdxAtTime(words, 441.6)).toBe(4); // inside "before," range
    expect(findWordIdxAtTime(words, 442.8)).toBe(7); // inside "rises" range
  });

  it("returns -1 for empty array", () => {
    expect(findWordIdxAtTime([], 1.0)).toBe(-1);
  });

  it("handles zero-duration words (start === end)", () => {
    const words = [
      { start: 0, end: 0 },
      { start: 5, end: 5 },
      { start: 10, end: 10 },
    ];
    expect(findWordIdxAtTime(words, 0)).toBe(0); // exact match on start=end
    expect(findWordIdxAtTime(words, 2)).toBe(0); // closer to word 0 (dist 2) than word 1 (dist 3)
    expect(findWordIdxAtTime(words, 4)).toBe(1); // closer to word 1 (dist 1) than word 0 (dist 4)
    expect(findWordIdxAtTime(words, 8)).toBe(2); // closer to word 2 (dist 2) than word 1 (dist 3)
  });
});

describe("computeChunkTimes", () => {
  it("uses min word.start per chunk for monotonic timings", () => {
    const words = [
      { start: 1, end: 2 },
      { start: 2, end: 3 },
      { start: 3, end: 4 },
      { start: 4, end: 5 },
      { start: 5, end: 6 },
      { start: 6, end: 7 },
    ];
    const chunks: [number, number][] = [
      [0, 2],
      [3, 5],
    ];
    expect(computeChunkTimes(words, chunks)).toEqual([1, 4]);
  });

  it("enforces monotonic order when chunks contain out-of-order times", () => {
    // Chunk 1 has words from late in the sentence (t=5,6), chunk 2 has earlier words (t=2,3).
    // Monotonic enforcement should bump chunk 2 up to match chunk 1's min time.
    const words = [
      { start: 5, end: 5 },
      { start: 6, end: 6 },
      { start: 2, end: 2 },
      { start: 3, end: 3 },
    ];
    const chunks: [number, number][] = [
      [0, 1],
      [2, 3],
    ];
    expect(computeChunkTimes(words, chunks)).toEqual([5, 5]);
  });
});

describe("findActiveChunkIdxAtTime", () => {
  it("returns the latest chunk whose time <= current time", () => {
    const chunkTimes = [0, 2, 4, 6, 8];
    expect(findActiveChunkIdxAtTime(chunkTimes, -1)).toBe(-1); // before first
    expect(findActiveChunkIdxAtTime(chunkTimes, 0)).toBe(0); // exact match
    expect(findActiveChunkIdxAtTime(chunkTimes, 1)).toBe(0);
    expect(findActiveChunkIdxAtTime(chunkTimes, 2)).toBe(1);
    expect(findActiveChunkIdxAtTime(chunkTimes, 5)).toBe(2);
    expect(findActiveChunkIdxAtTime(chunkTimes, 100)).toBe(4); // past last
  });

  it("returns -1 on empty input", () => {
    expect(findActiveChunkIdxAtTime([], 5)).toBe(-1);
  });

  it("never skips chunks for the problem case (non-monotonic English words)", () => {
    // 31 English words, 7 chunks — mirrors the TranslateContent bug report.
    // Built from the user's debug log: chunks 3 and 5 were being skipped.
    const chunks: [number, number][] = [
      [0, 4], // But I was very smart
      [5, 9], // and included this little thing
      [10, 14], // here that is a countertop,
      [15, 18], // it is an extension
      [19, 22], // of the countertop so
      [23, 26], // that I can have
      [27, 30], // more space to work.
    ];

    // These timedWords reflect the actual output of computeMatchedTimedWords
    // for the user's Spanish sentence, with reordering ("encimera" early, "extensión"
    // in middle, "countertop" repeated, etc.).
    const words = [
      { start: 345.38, end: 345.5 }, // 0 But (Pero)
      { start: 345.44, end: 345.44 }, // 1 I
      { start: 345.5, end: 346.12 }, // 2 was (fui)
      { start: 345.91, end: 345.91 }, // 3 very
      { start: 346.32, end: 346.68 }, // 4 smart (lista)
      { start: 346.94, end: 347.06 }, // 5 and (e)
      { start: 347.06, end: 347.44 }, // 6 included (incluí)
      { start: 347.37, end: 347.37 }, // 7 this
      { start: 347.68, end: 348.04 }, // 8 little (cosita)
      { start: 347.68, end: 348.04 }, // 9 thing (cosita)
      { start: 348.18, end: 348.42 }, // 10 here (aquí)
      { start: 348.91, end: 348.91 }, // 11 that
      { start: 349.64, end: 349.88 }, // 12 is (es)
      { start: 349.89, end: 349.89 }, // 13 a
      { start: 350.14, end: 350.64 }, // 14 countertop, (encimera,)
      { start: 349.89, end: 349.89 }, // 15 it
      { start: 349.64, end: 349.88 }, // 16 is (first-match on "is")
      { start: 350.44, end: 350.44 }, // 17 an
      { start: 351.24, end: 351.8 }, // 18 extension (extensión)
      { start: 350.87, end: 350.87 }, // 19 of
      { start: 350.51, end: 350.51 }, // 20 the
      { start: 350.14, end: 350.64 }, // 21 countertop (first-match)
      { start: 350.86, end: 350.86 }, // 22 so
      { start: 351.59, end: 351.59 }, // 23 that
      { start: 352.32, end: 352.32 }, // 24 I
      { start: 353.04, end: 353.36 }, // 25 can (poder)
      { start: 353.36, end: 353.68 }, // 26 have (tener)
      { start: 353.68, end: 354.02 }, // 27 more (más)
      { start: 354.24, end: 354.52 }, // 28 space (espacio)
      { start: 354.64, end: 354.64 }, // 29 to
      { start: 355.04, end: 355.4 }, // 30 work. (trabajar.)
    ];

    const chunkTimes = computeChunkTimes(words, chunks);
    // Verify monotonic
    for (let i = 1; i < chunkTimes.length; i++) {
      expect(chunkTimes[i]).toBeGreaterThanOrEqual(chunkTimes[i - 1]);
    }

    // Sweep time forward through the segment and confirm every chunk gets a turn.
    const seen = new Set<number>();
    for (let t = 345.38; t <= 355.4; t += 0.1) {
      const idx = findActiveChunkIdxAtTime(chunkTimes, t);
      if (idx >= 0) seen.add(idx);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);

    // Spot checks from the bug report
    expect(findActiveChunkIdxAtTime(chunkTimes, 345.38)).toBe(0);
    // At t=350.7, the old algorithm jumped directly to chunk 4 (skipping 3).
    // With chunk-time-based, chunk 3's time is ≤ 350.7, so we're on chunk 4
    // only because its time is also ≤ 350.7 — but chunk 3 got its time window earlier.
    // The test above (the sweep) is what proves chunk 3 isn't skipped.
  });
});
