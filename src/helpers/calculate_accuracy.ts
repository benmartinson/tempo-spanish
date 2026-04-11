import { AccuracyDetail, AccuracyResult } from "../types";
import { normalize } from "./helpers";

export const levenshtein = (a: string, b: string): number => {
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [
    i,
  ]);

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

function similarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const distance = levenshtein(a, b);
  const raw = 1 - distance / Math.max(a.length, b.length);

  // For short words (<= 3 chars), a single edit (e.g. "a" vs "al", "te" vs "de")
  // produces raw similarity of 0.5, which is below the 0.6 match threshold.
  // Boost these so 1-edit short words count as partial matches.
  if (Math.min(a.length, b.length) <= 3 && distance <= 1) {
    return Math.max(raw, 0.6);
  }

  return raw;
}

const autoMatchProperNouns = (
  details,
  spoken,
  usedSpokenIndices,
  matchedCount,
  matchedScore,
) => {
  const available = spoken
    .map((w, i) => (!usedSpokenIndices.has(i) ? i : -1))
    .filter((i) => i !== -1);

  let idx = 0;

  for (const detail of details) {
    if (!detail.matched && detail.isProperNoun && idx < available.length) {
      detail.matched = true;
      detail.spokenWord = detail.targetWord;
      detail._spokenIndex = available[idx];
      detail._matchScore = 1;

      idx++;
      matchedCount++;
      matchedScore += 1;
    }
  }

  return {
    finalMatchedCount: matchedCount,
    finalMatchedScore: matchedScore,
  };
};

const applyMatches = (matches, details, spoken, targets, originalSpoken) => {
  const usedSpokenIndices = new Set<number>();
  let matchedCount = 0;
  let matchedScore = 0;

  for (const { spokenIdx, detailIdx } of matches) {
    const detail = details[detailIdx];
    const score = similarity(spoken[spokenIdx], targets[detailIdx]);

    detail.matched = true;
    detail.spokenWord =
      score === 1 ? detail.targetWord : originalSpoken[spokenIdx];
    detail._spokenIndex = spokenIdx;
    detail._matchScore = score;

    usedSpokenIndices.add(spokenIdx);
    matchedCount++;
    matchedScore += score;
  }

  return { matchedCount, matchedScore, usedSpokenIndices };
};

const getNonProperTargetIndices = (details) =>
  details.map((d, i) => (d.isProperNoun ? -1 : i)).filter((i) => i !== -1);

const buildDetails = (targetWords, normalizedProperNouns) => {
  const details = [];
  const normalizedTargets = [];

  for (const targetWord of targetWords) {
    const nt = normalize(targetWord);
    if (!nt) continue;

    normalizedTargets.push(nt);

    const isProperNoun = normalizedProperNouns.some((noun) => noun === nt);

    details.push({
      targetWord,
      matched: false,
      isProperNoun,
    });
  }

  return { details, normalizedTargets };
};

const backtrackMatches = (dp, spoken, targets, targetIndices) => {
  let i = spoken.length;
  let j = targetIndices.length;

  const matches = [];

  while (i > 0 && j > 0) {
    const tIdx = targetIndices[j - 1];
    let score = similarity(spoken[i - 1], targets[tIdx]);

    if (
      score >= 0.6 &&
      Math.abs(dp[i][j] - (dp[i - 1][j - 1] + score)) < 1e-9
    ) {
      matches.push({ spokenIdx: i - 1, detailIdx: tIdx });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return matches.reverse();
};

const buildDpMatrix = (spoken, targets, targetIndices) => {
  const n = spoken.length;
  const m = targetIndices.length;

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const tIdx = targetIndices[j - 1];
      const score = similarity(spoken[i - 1], targets[tIdx]);

      if (score >= 0.6) {
        dp[i][j] = Math.max(
          dp[i - 1][j - 1] + score,
          dp[i - 1][j],
          dp[i][j - 1],
        );
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
};

const normalizeWords = (words: string[]) =>
  words.map(normalize).filter(Boolean);
/**
 * Calculate accuracy by comparing spoken words against target words.
 * Uses LCS (Longest Common Subsequence) to find the best order-preserving
 * alignment between spoken and target words.
 */

export const calculateAccuracy = (
  spokenWords: string[],
  targetWords: string[],
  properNouns: string[] = [],
) => {
  // console.log({ spokenWords, targetWords, properNouns });
  if (targetWords.length === 0) {
    return { percentage: 100, matchedWords: 0, totalWords: 0, details: [] };
  }

  const normalizedSpoken = normalizeWords(spokenWords);
  const normalizedProperNouns = normalizeWords(properNouns);

  const { details, normalizedTargets } = buildDetails(
    targetWords,
    normalizedProperNouns,
  );

  const targetIndices = getNonProperTargetIndices(details);

  const dp = buildDpMatrix(normalizedSpoken, normalizedTargets, targetIndices);

  const matches = backtrackMatches(
    dp,
    normalizedSpoken,
    normalizedTargets,
    targetIndices,
  );

  const { matchedCount, matchedScore, usedSpokenIndices } = applyMatches(
    matches,
    details,
    normalizedSpoken,
    normalizedTargets,
    spokenWords,
  );

  const { finalMatchedCount, finalMatchedScore } = autoMatchProperNouns(
    details,
    normalizedSpoken,
    usedSpokenIndices,
    matchedCount,
    matchedScore,
  );

  const totalWords = details.length;
  const percentage =
    totalWords > 0 ? Math.floor((finalMatchedScore / totalWords) * 100) : 0;

  return {
    percentage,
    matchedWords: finalMatchedCount,
    totalWords,
    details,
  };
};
