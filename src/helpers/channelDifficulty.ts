import { ChannelDifficulty } from "../types";

export const CHANNEL_DIFFICULTY_ORDER: ChannelDifficulty[] = [
  "beginner",
  "lower intermediate",
  "upper intermediate",
  "advanced",
];

export const normalizeChannelDifficulty = (
  value: unknown,
): ChannelDifficulty | null => {
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  return CHANNEL_DIFFICULTY_ORDER.includes(normalized as ChannelDifficulty)
    ? (normalized as ChannelDifficulty)
    : null;
};

export const channelDifficultyRank = (value: unknown) => {
  const normalized = normalizeChannelDifficulty(value);
  if (!normalized) return CHANNEL_DIFFICULTY_ORDER.length;
  return CHANNEL_DIFFICULTY_ORDER.indexOf(normalized);
};

export const isBeginnerLowerIntermediate = (value: unknown) => {
  const normalized = normalizeChannelDifficulty(value);
  return normalized === "beginner" || normalized === "lower intermediate";
};

export const channelDifficultyMatchesSelection = (
  channelDifficulty: unknown,
  selectedDifficulty: unknown,
) => {
  const normalizedChannelDifficulty =
    normalizeChannelDifficulty(channelDifficulty);
  const normalizedSelectedDifficulty =
    normalizeChannelDifficulty(selectedDifficulty);

  if (!normalizedChannelDifficulty || !normalizedSelectedDifficulty) {
    return false;
  }

  if (isBeginnerLowerIntermediate(normalizedSelectedDifficulty)) {
    return isBeginnerLowerIntermediate(normalizedChannelDifficulty);
  }

  return normalizedChannelDifficulty === normalizedSelectedDifficulty;
};
