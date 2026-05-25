jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

import {
  normalizeLevelBand,
  selectGuidedLearningPassage,
} from "./guidedLearning";

const makePassage = (overrides) => ({
  source: "top_verb_video",
  sourceKey: "top_verb_video:1",
  passageId: null,
  topVerbVideoId: 1,
  videoRecordId: "100",
  verbId: 10,
  language: "es",
  levelBand: "lower intermediate",
  rank: 1,
  skillFocus: "verb forms",
  startSegmentId: 1,
  endSegmentId: 3,
  difficultyLabel: "lower intermediate",
  score: 10,
  ...overrides,
});

describe("guided learning selection", () => {
  it("normalizes common difficulty labels into level bands", () => {
    expect(normalizeLevelBand("Beginner")).toBe("beginner");
    expect(normalizeLevelBand("Upper Intermediate")).toBe("upper intermediate");
    expect(normalizeLevelBand("advanced")).toBe("advanced");
    expect(normalizeLevelBand("intermediate")).toBe("lower intermediate");
  });

  it("prefers an uncompleted passage in the selected level band", () => {
    const completed = makePassage({
      sourceKey: "top_verb_video:1",
      rank: 1,
    });
    const next = makePassage({
      sourceKey: "top_verb_video:2",
      rank: 2,
    });
    const advanced = makePassage({
      sourceKey: "top_verb_video:3",
      levelBand: "advanced",
      rank: 1,
    });

    expect(
      selectGuidedLearningPassage({
        candidates: [completed, next, advanced],
        progress: {
          "top_verb_video:1": {
            sourceKey: "top_verb_video:1",
            passageId: null,
            status: "completed",
            confidence: 4,
            updatedAt: "2026-05-24T00:00:00.000Z",
          },
        },
        targetLevelBand: "lower intermediate",
      }),
    ).toBe(next);
  });
});
