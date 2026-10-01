"""Laya-backed DecisionEngine and the Argos <-> Laya translation.

The translation functions are pure so they can be tested without torch.
"""

from .schemas import ChoiceQuestion, Question, ScoreQuestion

HF_REPO = "convaiinnovations/laya"
SUBFOLDER = "multilingual"
MODEL_NAME = "laya-multilingual"


def to_laya_questions(questions: dict[str, Question]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for name, q in questions.items():
        if isinstance(q, ChoiceQuestion):
            out[name] = {"type": "choice", "instructions": q.instructions, "criteria": dict(q.criteria)}
        elif isinstance(q, ScoreQuestion):
            out[name] = {"type": "score", "instructions": q.instructions, "criteria": list(q.criteria)}
        else:
            lq = {"type": "noul", "instructions": q.instructions}
            if q.criteria:
                lq["criteria"] = {"false": q.criteria["no"], "true": q.criteria["yes"]}
            out[name] = lq
    return out


def from_laya_answers(
    questions: dict[str, Question], laya_answers: dict[str, dict], min_confidence: float | None
) -> dict[str, dict]:
    answers: dict[str, dict] = {}
    for name, q in questions.items():
        raw = laya_answers[name]
        # answer_confidence is max(p): the calibrated value Laya's own min_confidence reads.
        confidence = raw["answer_confidence"]
        if isinstance(q, ChoiceQuestion):
            answer = {"choice": raw["choice"], "probabilities": raw["probabilities"], "confidence": confidence}
        elif isinstance(q, ScoreQuestion):
            levels = len(q.criteria)
            score = raw["score"]
            answer = {
                "score": score,
                "level": q.criteria[min(levels - 1, max(0, round(score)))],
                "probabilities": [raw["probabilities"][str(i)] for i in range(levels)],
                "confidence": confidence,
            }
        else:
            probability = raw["noul"]
            answer = {"probability": probability, "answer": probability >= 0.5, "confidence": confidence}
        if min_confidence is not None:
            answer["low_confidence"] = confidence < min_confidence
        answers[name] = answer
    return answers


class LayaEngine:
    model_name = MODEL_NAME

    def __init__(self, revision: str = "", threads: int = 3) -> None:
        self._revision = revision or None
        self._threads = threads
        self._agent = None

    def load(self) -> None:
        import laya
        import torch

        torch.set_num_threads(self._threads)
        self._agent = laya.load(HF_REPO, subfolder=SUBFOLDER, revision=self._revision)

    def decide(self, text, questions, min_confidence):
        result = self._agent.predict(text, to_laya_questions(questions))
        return from_laya_answers(questions, result["answers"], min_confidence)
