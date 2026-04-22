import { useMemo, useRef } from "react";

interface StableChunksParams {
  wordCount: number;
  rawWordIdx: number;
  isReplay: boolean;
  resetKey: string | number;
  chunkSize?: number;
}

interface StableChunksResult {
  chunks: [number, number][];
  activeChunkStart: number;
  activeChunkEnd: number;
  displayWordIdx: number;
}

/**
 * Splits `wordCount` words into chunks of ~`chunkSize`, evenly distributed
 * (e.g. 7 words with size 5 → [4,3] rather than [5,2]).
 */
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
 * Computes evenly-sized word chunks and tracks which chunk is currently active.
 * The active chunk never decreases unless `isReplay` is true or `resetKey` changes —
 * this prevents highlight jump-back when interpolated time briefly runs ahead of real time.
 *
 * Pass `rawWordIdx = -1` to indicate "inactive"; the result will have activeChunkStart/End = -1.
 */
export const useStableChunkIdx = ({
  wordCount,
  rawWordIdx,
  isReplay,
  resetKey,
  chunkSize = 5,
}: StableChunksParams): StableChunksResult => {
  const chunks = useMemo(
    () => computeChunks(wordCount, chunkSize),
    [wordCount, chunkSize],
  );

  const highestRef = useRef(-1);
  const prevResetKeyRef = useRef(resetKey);

  if (prevResetKeyRef.current !== resetKey) {
    highestRef.current = -1;
    prevResetKeyRef.current = resetKey;
  }

  if (rawWordIdx < 0 || !chunks.length) {
    return {
      chunks,
      activeChunkStart: -1,
      activeChunkEnd: -1,
      displayWordIdx: rawWordIdx,
    };
  }

  const rawChunkIdx = chunks.findIndex(
    ([s, e]) => rawWordIdx >= s && rawWordIdx <= e,
  );

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

  const activeChunk = chunks[stableChunkIdx] ?? [-1, -1];
  const displayWordIdx =
    stableChunkIdx > rawChunkIdx ? activeChunk[0] : rawWordIdx;

  return {
    chunks,
    activeChunkStart: activeChunk[0],
    activeChunkEnd: activeChunk[1],
    displayWordIdx,
  };
};
