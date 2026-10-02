import json
from collections import Counter
from pathlib import Path

from argos_api.oracle import (
    EIGHTBALL_QUESTION,
    PHRASES,
    YESNO_QUESTION,
    eightball_answer,
    percentages,
    yesno_answer,
)
from argos_api.schemas import MAX_OPTIONS


def test_phrases_split_10_5_5_most_negative_first():
    assert len(PHRASES) == 20 == MAX_OPTIONS
    assert Counter(kind for _, kind in PHRASES) == {"affirmative": 10, "non_committal": 5, "negative": 5}
    kinds = [kind for _, kind in PHRASES]
    assert kinds == ["negative"] * 5 + ["non_committal"] * 5 + ["affirmative"] * 10
    assert len({p for p, _ in PHRASES}) == 20


def test_fixed_questions():
    assert YESNO_QUESTION.type == "yesno"
    assert EIGHTBALL_QUESTION.type == "score"
    assert EIGHTBALL_QUESTION.criteria == [p for p, _ in PHRASES]


def test_yesno_answer_threshold():
    assert yesno_answer({"probability": 0.5, "answer": True, "confidence": 0.5}) == {
        "answer": True,
        "probability": 0.5,
        "confidence": 0.5,
    }
    assert yesno_answer({"probability": 0.4999, "confidence": 0.5001, "low_confidence": True})["answer"] is False
    assert "low_confidence" not in yesno_answer({"probability": 0.9, "confidence": 0.9, "low_confidence": False})


def test_percentages_sum_to_exactly_100():
    probs = [0.0513, 0.0491, 0.0487, 0.0502, 0.0499, 0.0501, 0.0498, 0.0503, 0.0496, 0.0505,
             0.0494, 0.0508, 0.0497, 0.0506, 0.0493, 0.0509, 0.0492, 0.0504, 0.0500, 0.0502]
    pcts = percentages(probs)
    assert round(sum(p * 10 for p in pcts)) == 1000
    assert all(round(p, 1) == p for p in pcts)
    assert percentages([1 / 3] * 3) == [33.4, 33.3, 33.3]


def test_percentages_degenerate_input():
    assert percentages([0.0] * 4) == [25.0] * 4


def test_tie_picks_lower_index():
    result = eightball_answer({"probabilities": [0.05] * 20})
    assert result["answer"] == PHRASES[0][0]
    assert result["kind"] == "negative"


def test_eightball_answer_is_argmax_not_level():
    probs = [0.0] * 20
    probs[18], probs[0], probs[9] = 0.4, 0.35, 0.25
    result = eightball_answer({"score": 7.5, "level": PHRASES[8][0], "probabilities": probs, "confidence": 0.4})
    assert result["answer"] == "Sin lugar a dudas"
    assert result["kind"] == "affirmative"
    assert [p["phrase"] for p in result["phrases"]] == [p for p, _ in PHRASES]
    assert result["phrases"][18]["percentage"] == 40.0


def test_totals_equal_sum_of_their_phrases():
    probs = [(i + 1) / 210 for i in range(20)]
    result = eightball_answer({"probabilities": probs})
    for kind, total in result["totals"].items():
        expected = sum(p["percentage"] for p in result["phrases"] if p["kind"] == kind)
        assert abs(total - expected) < 1e-9
    assert round(sum(result["totals"].values()) * 10) == 1000


def test_eval_set_has_at_least_30_questions():
    path = Path(__file__).resolve().parent.parent / "evals" / "oracle.jsonl"
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    assert len(rows) >= 30
    assert all(r["question"].strip() and isinstance(r["open"], bool) for r in rows)
    assert len({r["question"] for r in rows}) == len(rows)
