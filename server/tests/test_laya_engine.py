import os

import pytest
from pydantic import TypeAdapter

from argos_api.laya_engine import LayaEngine, from_laya_answers, to_laya_questions
from argos_api.schemas import Question

QUESTIONS = TypeAdapter(dict[str, Question]).validate_python(
    {
        "department": {
            "type": "choice",
            "instructions": "¿Qué departamento debe gestionarlo?",
            "criteria": {"billing": "pagos, facturas, reembolsos", "technical": "errores, caídas", "other": "todo lo demás"},
        },
        "urgency": {"type": "score", "instructions": "¿Cómo de urgente es?", "criteria": ["nada urgente", "pronto", "bloqueante"]},
        "churn": {
            "type": "yesno",
            "instructions": "¿El usuario amenaza con cancelar o irse?",
            "criteria": {"yes": "amenaza con irse", "no": "no amenaza"},
        },
    }
)

# Recorded from laya 0.3.22 / laya-multilingual on void-server (task 1.1 spike).
LAYA_ANSWERS = {
    "department": {
        "type": "choice",
        "choice": "billing",
        "probabilities": {"billing": 0.9999, "technical": 0.0, "other": 0.0001},
        "confidence": 0.9988,
        "answer_confidence": 0.9999,
        "action": {"act_probability": 1.0},
    },
    "urgency": {
        "type": "score",
        "score": 1.6728,
        "legend": {"0": "nada urgente", "1": "pronto", "2": "bloqueante"},
        "probabilities": {"0": 0.016, "1": 0.2953, "2": 0.6888},
        "confidence": 0.3783,
        "answer_confidence": 0.6888,
        "action": {"act_probability": 1.0},
    },
    "churn": {"type": "noul", "noul": 0.7293, "confidence": 0.7293, "answer_confidence": 0.7293, "action": {"act_probability": 1.0}},
}


def test_to_laya_questions_maps_yesno_to_noul():
    laya_q = to_laya_questions(QUESTIONS)
    assert laya_q["department"]["type"] == "choice"
    assert laya_q["department"]["criteria"]["billing"] == "pagos, facturas, reembolsos"
    assert laya_q["urgency"] == {"type": "score", "instructions": "¿Cómo de urgente es?", "criteria": ["nada urgente", "pronto", "bloqueante"]}
    assert laya_q["churn"] == {
        "type": "noul",
        "instructions": "¿El usuario amenaza con cancelar o irse?",
        "criteria": {"false": "no amenaza", "true": "amenaza con irse"},
    }


def test_yesno_without_criteria_sends_none():
    qs = TypeAdapter(dict[str, Question]).validate_python({"q": {"type": "yesno", "instructions": "?"}})
    assert to_laya_questions(qs)["q"] == {"type": "noul", "instructions": "?"}


def test_from_laya_answers_shapes():
    answers = from_laya_answers(QUESTIONS, LAYA_ANSWERS, None)
    assert answers["department"] == {
        "choice": "billing",
        "probabilities": {"billing": 0.9999, "technical": 0.0, "other": 0.0001},
        "confidence": 0.9999,
    }
    assert answers["urgency"] == {
        "score": 1.6728,
        "level": "bloqueante",
        "probabilities": [0.016, 0.2953, 0.6888],
        "confidence": 0.6888,
    }
    assert answers["churn"] == {"probability": 0.7293, "answer": True, "confidence": 0.7293}


def test_low_confidence_flag():
    answers = from_laya_answers(QUESTIONS, LAYA_ANSWERS, 0.9)
    assert answers["department"]["low_confidence"] is False
    assert answers["urgency"]["low_confidence"] is True
    assert answers["churn"]["low_confidence"] is True


@pytest.mark.model
def test_real_model_smoke():
    engine = LayaEngine(revision=os.environ.get("ARGOS_MODEL_REVISION", ""), threads=3)
    engine.load()
    text = "Me han cobrado dos veces este mes. Quiero un reembolso hoy o cancelo la suscripción."
    answers = engine.decide(text, QUESTIONS, None)
    assert answers["department"]["choice"] == "billing"
    assert 0 <= answers["urgency"]["score"] <= 2
    assert 0 <= answers["churn"]["probability"] <= 1
