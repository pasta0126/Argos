import threading

import httpx
import pytest

from argos_api.config import Settings
from argos_api.main import create_app

KEYS = "kaizen:kaizen-key-0123456789,cli:cli-key-0123456789"
AUTH = {"Authorization": "Bearer kaizen-key-0123456789"}


class FakeEngine:
    """Stands in for Laya: deterministic answers, optional blocking to test the queue."""

    model_name = "fake"

    def __init__(self, load_blocks: bool = False) -> None:
        self.release_load = threading.Event()
        if not load_blocks:
            self.release_load.set()
        self.release_decide = threading.Event()
        self.release_decide.set()
        self.decide_started = threading.Event()
        self.calls: list[tuple] = []

    def load(self) -> None:
        self.release_load.wait(5)

    def decide(self, text, questions, min_confidence):
        self.calls.append((text, questions, min_confidence))
        self.decide_started.set()
        self.release_decide.wait(5)
        answers = {}
        for name, q in questions.items():
            if q.type == "choice":
                labels = list(q.criteria)
                probs = {label: (0.7 if i == 0 else 0.3 / (len(labels) - 1)) for i, label in enumerate(labels)}
                answers[name] = {"choice": labels[0], "probabilities": probs, "confidence": 0.7}
            elif q.type == "score":
                # One probability per level, peaking at level 1 (the second).
                n = len(q.criteria)
                probs = [0.4 if i == 1 else round(0.6 / (n - 1), 4) for i in range(n)]
                answers[name] = {"score": 1.2, "level": q.criteria[1], "probabilities": probs, "confidence": 0.4}
            else:
                answers[name] = {"probability": 0.9, "answer": True, "confidence": 0.9}
            if min_confidence is not None:
                answers[name]["low_confidence"] = answers[name]["confidence"] < min_confidence
        return answers


def make_settings(**overrides) -> Settings:
    return Settings(_env_file=None, argos_api_keys=overrides.pop("argos_api_keys", KEYS), **overrides)


@pytest.fixture
def engine():
    return FakeEngine()


@pytest.fixture
async def client(engine):
    app = create_app(make_settings(), engine)
    async with app.router.lifespan_context(app):
        assert app.state.ready.wait(5)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


def triage_body(**extra):
    body = {
        "text": "Me han cobrado dos veces, quiero un reembolso",
        "questions": {
            "department": {
                "type": "choice",
                "instructions": "¿Qué departamento?",
                "criteria": {"billing": "pagos", "technical": "errores"},
            },
            "refund": {"type": "yesno", "instructions": "¿Pide un reembolso?"},
        },
    }
    body.update(extra)
    return body
