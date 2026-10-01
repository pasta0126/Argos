from typing import Protocol

from .schemas import Question


class DecisionEngine(Protocol):
    """What the HTTP layer needs from a decision model. Laya hides behind this."""

    model_name: str

    def load(self) -> None:
        """Blocking: download/load weights. Called once, off the event loop."""

    def decide(
        self, text: str, questions: dict[str, Question], min_confidence: float | None
    ) -> dict[str, dict]:
        """Blocking: answer every question, keyed by question name (Argos response shape)."""
