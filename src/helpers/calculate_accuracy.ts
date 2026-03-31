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
  return 1 - distance / Math.max(a.length, b.length);
}

const autoMatchProperNouns = (
  details,
  spoken,
  usedSpokenIndices,
  matchedCount,
  matchedScore,
) => {
  const available = spoken
    .map((w, i) => (!usedSpokenIndices.has(i) && w.length > 2 ? i : -1))
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
    console.log({ spoken: spoken[i - 1], target: targets[tIdx], score });
    if (spoken[i - 1] === "presente") {
      console.log({ score });
    }

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

// export const calculateAccuracy = (
//   spokenWords: string[],
//   targetWords: string[],
//   properNouns: string[] = [],
// ) => {
//   if (targetWords.length === 0) {
//     return { percentage: 100, matchedWords: 0, totalWords: 0, details: [] };
//   }

//   const normalizedSpoken = normalizeWords(spokenWords);
//   const normalizedProperNouns = normalizeWords(properNouns);

//   const { details, normalizedTargets } = buildDetails(
//     targetWords,
//     normalizedProperNouns,
//   );

//   const targetIndices = getNonProperTargetIndices(details);

//   const dp = buildDpMatrix(normalizedSpoken, normalizedTargets, targetIndices);

//   const matches = backtrackMatches(
//     dp,
//     normalizedSpoken,
//     normalizedTargets,
//     targetIndices,
//   );

//   const { matchedCount, matchedScore, usedSpokenIndices } = applyMatches(
//     matches,
//     details,
//     normalizedSpoken,
//     normalizedTargets,
//     spokenWords,
//   );

//   const { finalMatchedCount, finalMatchedScore } = autoMatchProperNouns(
//     details,
//     normalizedSpoken,
//     usedSpokenIndices,
//     matchedCount,
//     matchedScore,
//   );

//   const totalWords = details.length;
//   const percentage =
//     totalWords > 0 ? Math.floor((finalMatchedScore / totalWords) * 100) : 0;

//   return {
//     percentage,
//     matchedWords: finalMatchedCount,
//     totalWords,
//     details,
//   };
// };
export const calculateAccuracy = (
  spokenWords: string[],
  targetWords: string[],
  properNouns: string[] = [],
) => {
  console.log({ spokenWords, targetWords, properNouns });
  if (targetWords.length === 0) {
    return { percentage: 100, matchedWords: 0, totalWords: 0, details: [] };
  }

  const normalizedSpoken = spokenWords.map(normalize).filter(Boolean);
  const normalizedTargets = targetWords.map(normalize);
  const normalizedProperNouns = properNouns.map(normalize);

  const details = targetWords.map((t) => ({
    targetWord: t,
    matched: false,
    isProperNoun: normalizedProperNouns.includes(normalize(t)),
  }));

  const n = normalizedSpoken.length;
  const m = normalizedTargets.length;
  const dpTargets = normalizedTargets.map((t, idx) =>
    details[idx].isProperNoun ? null : t,
  );

  // dp[i][j] = max total similarity score using spoken[0..i-1] vs target[0..j-1]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  const backtrack: ("diag" | "up" | "left")[][] = Array.from(
    { length: n + 1 },
    () => new Array(m + 1).fill("left"),
  );

  // Fill DP table
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const score =
        dpTargets[j - 1] !== null
          ? similarity(normalizedSpoken[i - 1], dpTargets[j - 1])
          : 0;

      // Proximity bonus: favor contiguous matches
      const proximityBonus =
        i > 1 && j > 1 ? dp[i - 1][j - 1] - dp[i - 2][j - 2] : 0;
      const totalScore = score + 0.1 * proximityBonus;

      const choices = [
        { val: dp[i - 1][j], dir: "up" },
        { val: dp[i][j - 1], dir: "left" },
        { val: dp[i - 1][j - 1] + totalScore, dir: "diag" },
      ];

      // Pick max, break ties in favor of diag (later sequences)
      let best = choices[0];
      for (const c of choices) {
        if (c.val > best.val) best = c;
        else if (c.val === best.val && c.dir === "diag") best = c;
      }

      dp[i][j] = best.val;
      backtrack[i][j] = best.dir as any;
    }
  }

  // Backtrack to find matches
  let i = n;
  let j = m;
  const matches: { spokenIdx: number; targetIdx: number; score: number }[] = [];

  while (i > 0 && j > 0) {
    if (backtrack[i][j] === "diag") {
      const score =
        dpTargets[j - 1] !== null
          ? similarity(normalizedSpoken[i - 1], dpTargets[j - 1])
          : 0;
      if (score > 0) {
        matches.push({ spokenIdx: i - 1, targetIdx: j - 1, score });
      }
      i--;
      j--;
    } else if (backtrack[i][j] === "up") {
      i--;
    } else {
      j--;
    }
  }

  matches.reverse();

  // Apply matches to details
  const usedSpoken = new Set<number>();
  let matchedScore = 0;
  for (const { spokenIdx, targetIdx, score } of matches) {
    details[targetIdx].matched = true;
    details[targetIdx].spokenWord =
      score === 1 ? details[targetIdx].targetWord : spokenWords[spokenIdx];
    details[targetIdx]._spokenIndex = spokenIdx;
    details[targetIdx]._matchScore = score;
    matchedScore += score;
    usedSpoken.add(spokenIdx);
  }

  const unmatchedSpokenIndices = normalizedSpoken
    .map((w, i) => (!usedSpoken.has(i) ? i : -1))
    .filter((i) => i !== -1);

  let unmatchedIdx = 0;
  for (const detail of details) {
    if (
      !detail.matched &&
      detail.isProperNoun &&
      unmatchedIdx < unmatchedSpokenIndices.length
    ) {
      const spokenIdx = unmatchedSpokenIndices[unmatchedIdx];
      detail.matched = true;
      detail.spokenWord = detail.targetWord;
      detail._spokenIndex = spokenIdx;
      detail._matchScore = 1;
      unmatchedIdx++;
      matchedScore += 1;
      matches.push({ spokenIdx, targetIdx: spokenIdx, score: 1 });
    }
  }

  const totalWords = details.length;
  const matchedWords = matches.length;
  const percentage =
    totalWords > 0 ? Math.floor((matchedScore / totalWords) * 100) : 0;

  return { details, matchedWords, totalWords, percentage };
};
