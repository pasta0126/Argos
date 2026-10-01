from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Limits from the decision-api spec. Exceeding them is 413, not 422, so they are
# checked by `limit_violation` in the route, not as Pydantic constraints.
MAX_TEXT_CHARS = 8000
MAX_QUESTIONS = 10
MAX_OPTIONS = 20

NonEmpty = Annotated[str, Field(min_length=1)]


class _Question(BaseModel):
    model_config = ConfigDict(extra="forbid")

    instructions: NonEmpty


class ChoiceQuestion(_Question):
    type: Literal["choice"]
    # option label -> description
    criteria: Annotated[dict[NonEmpty, NonEmpty], Field(min_length=2)]


class ScoreQuestion(_Question):
    type: Literal["score"]
    # level descriptions, lowest first
    criteria: Annotated[list[NonEmpty], Field(min_length=2)]


class YesNoQuestion(_Question):
    type: Literal["yesno"]
    # optional descriptions of each outcome: exactly {"yes": ..., "no": ...}
    criteria: dict[NonEmpty, NonEmpty] | None = None

    @field_validator("criteria")
    @classmethod
    def _yes_no_keys(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        if value is not None and set(value) != {"yes", "no"}:
            raise ValueError("yesno criteria must have exactly the keys 'yes' and 'no'")
        return value


Question = Annotated[Union[ChoiceQuestion, ScoreQuestion, YesNoQuestion], Field(discriminator="type")]


class DecideRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: NonEmpty
    questions: Annotated[dict[NonEmpty, Question], Field(min_length=1)]
    min_confidence: Annotated[float, Field(ge=0.0, le=1.0)] | None = None


class DecideResponse(BaseModel):
    answers: dict[str, dict]
    model: str
    latency_ms: int


def limit_violation(req: DecideRequest) -> str | None:
    """Return why the request exceeds a size limit, or None if it fits."""
    if len(req.text) > MAX_TEXT_CHARS:
        return f"text exceeds {MAX_TEXT_CHARS} characters"
    if len(req.questions) > MAX_QUESTIONS:
        return f"more than {MAX_QUESTIONS} questions"
    for name, q in req.questions.items():
        if isinstance(q, (ChoiceQuestion, ScoreQuestion)) and len(q.criteria) > MAX_OPTIONS:
            return f"question {name!r} has more than {MAX_OPTIONS} options"
    return None
