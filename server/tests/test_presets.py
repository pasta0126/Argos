import json
from collections import defaultdict
from pathlib import Path

import pytest

from argos_api.presets import PRESETS
from argos_api.schemas import MAX_OPTIONS, MAX_QUESTIONS, DecideRequest, limit_violation


@pytest.mark.parametrize("name", sorted(PRESETS))
def test_preset_is_a_valid_decide_request(name):
    preset = PRESETS[name]
    assert preset.description
    assert 1 <= len(preset.questions) <= MAX_QUESTIONS
    body = DecideRequest(text="hola", questions=preset.questions)
    assert limit_violation(body) is None
    for q in preset.questions.values():
        if q.type != "yesno":
            assert len(q.criteria) <= MAX_OPTIONS


EVAL_SET = Path(__file__).resolve().parent.parent / "evals" / "presets.jsonl"


def _eval_rows():
    return [json.loads(line) for line in EVAL_SET.read_text().splitlines() if line.strip()]


def test_eval_labels_reference_published_questions():
    for row in _eval_rows():
        preset = PRESETS[row["preset"]]
        assert row["text"] and isinstance(row["holdout"], bool)
        for name, expected in row["expected"].items():
            q = preset.questions[name]
            if q.type == "choice":
                assert expected in q.criteria, (row["text"], name)
            elif q.type == "score":
                assert isinstance(expected, int) and 0 <= expected < len(q.criteria), (row["text"], name)
            else:
                assert isinstance(expected, bool), (row["text"], name)


@pytest.mark.parametrize("name", sorted(PRESETS))
def test_eval_coverage(name):
    # Coverage rules from design D6, for every published question.
    labels = defaultdict(list)
    for row in _eval_rows():
        if row["preset"] == name:
            for q, expected in row["expected"].items():
                labels[q].append(expected)
    for q_name, q in PRESETS[name].questions.items():
        got = labels[q_name]
        assert len(got) >= 10, (q_name, len(got))
        if q.type == "yesno":
            assert got.count(True) >= 3 and got.count(False) >= 3, q_name
        elif q.type == "choice":
            assert set(q.criteria) <= set(got), (q_name, set(q.criteria) - set(got))
        else:
            assert set(range(len(q.criteria))) <= set(got), q_name
