import { useMemo, useRef } from "react";

interface WordTiming {
  start: number;
  end: number;
}

interface StableChunksParams {
  words: WordTiming[];
  time: number;
  isReplay: boolean;
  resetKey: string | number;
  chunkSize?: number;
  overrideWordIdx?: number; // bypass time-based lookup (e.g. shadow mode)
  inactive?: boolean; // e.g. player not playing
}

interface StableChunksResult {
  chunks: [number, number][];
  activeChunkStart: number;
  activeChunkEnd: number;
  displayWordIdx: number;
}

const computeChunks = (
  wordCount: number,
  chunkSize: number,
): [number, number][] => {
  if (wordCount <= 0) return [];
  const numChunks = Math.ceil(wordCount / chunkSize);
  const base = Math.floor(wordCount / numChunks);
  const extras = wordCount - base * numChunks;
  const result: [number, number][] = [];
  let i = 0;
  for (let c = 0; c < numChunks; c++) {
    const size = base + (c < extras ? 1 : 0);
    result.push([i, i + size - 1]);
    i += size;
  }
  return result;
};

/**
 * Computes a representative start time for each chunk (the min word.start within
 * it), then enforces monotonically non-decreasing order so chunks always advance
 * forward in time. Handles non-monotonic word timings caused by cross-language
 * word reordering.
 */
export const computeChunkTimes = (
  words: WordTiming[],
  chunks: [number, number][],
): number[] => {
  const times: number[] = [];
  let floor = -Infinity;
  for (const [s, e] of chunks) {
    let minTime = Infinity;
    for (let i = s; i <= e; i++) {
      const w = words[i];
      if (w && w.start < minTime) minTime = w.start;
    }
    if (!isFinite(minTime)) minTime = floor === -Infinity ? 0 : floor;
    if (minTime < floor) minTime = floor;
    times.push(minTime);
    floor = minTime;
  }
  return times;
};

/**
 * Returns the index of the chunk whose representative time window contains
 * `time` — that is, the last chunk whose time <= `time`. Returns -1 before the
 * first chunk's time. Assumes `chunkTimes` is monotonically non-decreasing
 * (as produced by `computeChunkTimes`).
 */
export const findActiveChunkIdxAtTime = (
  chunkTimes: number[],
  time: number,
): number => {
  if (!chunkTimes.length) return -1;
  let active = -1;
  for (let i = 0; i < chunkTimes.length; i++) {
    if (chunkTimes[i] <= time) active = i;
    else break;
  }
  return active;
};

/**
 * Finds the word index whose timing is closest to `time`.
 *
 * Uses a closest-midpoint search so it works correctly even when timings are
 * non-monotonic (which happens when English translation words are matched to
 * Spanish word timings and the two languages have different word order).
 * When multiple words are equidistant, the first one wins.
 */
export const findWordIdxAtTime = (
  words: WordTiming[],
  time: number,
): number => {
  if (!words.length) return -1;
  // Prefer a word whose [start, end] range contains the time
  for (let i = 0; i < words.length; i++) {
    if (time >= words[i].start && time <= words[i].end) return i;
  }
  // Otherwise pick the word whose midpoint is closest
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < words.length; i++) {
    const mid = (words[i].start + words[i].end) / 2;
    const dist = Math.abs(time - mid);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
};

/**
 * Given timed words and a current playback time, returns the active chunk's
 * start/end indexes with jump-back protection (the chunk never decreases unless
 * `isReplay` is true or `resetKey` changes).
 */
export const useStableChunkIdx = ({
  words,
  time,
  isReplay,
  resetKey,
  chunkSize = 5,
  overrideWordIdx,
  inactive,
}: StableChunksParams): StableChunksResult => {
  const chunks = useMemo(
    () => computeChunks(words.length, chunkSize),
    [words.length, chunkSize],
  );

  const chunkTimes = useMemo(
    () => computeChunkTimes(words, chunks),
    [words, chunks],
  );

  const highestRef = useRef(-1);
  const prevResetKeyRef = useRef(resetKey);

  if (prevResetKeyRef.current !== resetKey) {
    highestRef.current = -1;
    prevResetKeyRef.current = resetKey;
  }

  if (inactive || !chunks.length) {
    return {
      chunks,
      activeChunkStart: -1,
      activeChunkEnd: -1,
      displayWordIdx: overrideWordIdx ?? -1,
    };
  }

  // Determine which chunk time maps to — override goes via word index (shadow mode),
  // otherwise use monotonic chunk times (handles non-monotonic word timings).
  let rawChunkIdx: number;
  if (overrideWordIdx !== undefined) {
    rawChunkIdx = chunks.findIndex(
      ([s, e]) => overrideWordIdx >= s && overrideWordIdx <= e,
    );
  } else {
    rawChunkIdx = findActiveChunkIdxAtTime(chunkTimes, time);
  }

  let stableChunkIdx: number;
  if (isReplay) {
    highestRef.current = rawChunkIdx;
    stableChunkIdx = rawChunkIdx;
  } else {
    if (rawChunkIdx > highestRef.current) {
      highestRef.current = rawChunkIdx;
    }
    stableChunkIdx = highestRef.current;
  }

  if (stableChunkIdx < 0) {
    return {
      chunks,
      activeChunkStart: -1,
      activeChunkEnd: -1,
      displayWordIdx: overrideWordIdx ?? -1,
    };
  }

  const activeChunk = chunks[stableChunkIdx] ?? [-1, -1];
  const rawWordIdx =
    overrideWordIdx !== undefined
      ? overrideWordIdx
      : findWordIdxAtTime(words, time);
  const displayWordIdx =
    stableChunkIdx > rawChunkIdx ? activeChunk[0] : rawWordIdx;

  return {
    chunks,
    activeChunkStart: activeChunk[0],
    activeChunkEnd: activeChunk[1],
    displayWordIdx,
  };
};
