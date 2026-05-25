import unittest

from build_guided_learning_passages import (
    Candidate,
    JudgedCandidate,
    Judgement,
    resolve_course_band,
    select_course_passages,
    verb_tier,
)


def make_judged(
    index,
    *,
    verb="ir",
    db_difficulty="Beginner",
    estimated_level_band="beginner",
    eligible=True,
    quality=20,
    video_id=None,
):
    candidate = Candidate(
        top_verb_video_id=index,
        video_id=video_id or index,
        verb_id=index,
        verb=verb,
        verb_tier=verb_tier(verb),
        verb_count=4,
        video_title="video",
        db_difficulty=db_difficulty,
        start_segment_id=1,
        end_segment_id=2,
        passage_text="Voy a casa y luego vamos al mercado.",
        passage_preview="Voy a casa y luego vamos al mercado.",
        word_count=9,
        proper_noun_guess_count=0,
    )
    judgement = Judgement(
        eligible=eligible,
        interest_score=4,
        clarity_score=4,
        proper_noun_load=1,
        learner_value_score=4,
        estimated_level_band=estimated_level_band,
        estimated_cefr="A2",
        rejection_reason="",
        short_rationale="clear",
    )
    return JudgedCandidate(
        candidate=candidate,
        judgement=judgement,
        course_band=resolve_course_band(candidate, judgement),
        quality_score=quality,
    )


class GuidedLearningCurationTests(unittest.TestCase):
    def test_common_verbs_rank_as_easier_than_default_verbs(self):
        self.assertEqual(verb_tier("ir"), 1)
        self.assertEqual(verb_tier("frenar"), 3)

    def test_rare_verbs_floor_to_upper_intermediate(self):
        item = make_judged(1, verb="frenar", estimated_level_band="beginner")
        self.assertEqual(item.course_band, "upper intermediate")

    def test_select_course_passages_enforces_basic_diversity(self):
        judged = [
            make_judged(i, verb="ir", quality=50 - i, video_id=1)
            for i in range(1, 8)
        ] + [
            make_judged(100 + i, verb="tener", quality=30 - i, video_id=100 + i)
            for i in range(1, 8)
        ] + [
            make_judged(200 + i, verb="hacer", quality=20 - i, video_id=200 + i)
            for i in range(1, 8)
        ]
        selected = select_course_passages(
            judged,
            targets={"beginner": 6},
            max_per_verb=3,
            max_per_video=2,
        )
        self.assertEqual(len(selected), 6)
        self.assertLessEqual(sum(1 for item in selected if item.candidate.verb == "ir"), 3)
        self.assertLessEqual(sum(1 for item in selected if item.candidate.video_id == 1), 2)


if __name__ == "__main__":
    unittest.main()
