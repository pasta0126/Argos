from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, create_model, field_validator

# Limits from the decision-api spec. Exceeding them is 413, not 422, so they are
# checked by `limit_violation` in the route, not as Pydantic constraints.
MAX_TEXT_CHARS = 8000
MAX_QUESTIONS = 10
MAX_OPTIONS = 20
MAX_QUESTION_CHARS = 500  # oracle questions

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


class PresetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: NonEmpty
    min_confidence: Annotated[float, Field(ge=0.0, le=1.0)] | None = None
    # Subset of the preset's question names; None means all of them.
    questions: Annotated[list[NonEmpty], Field(min_length=1)] | None = None


class PresetResponse(DecideResponse):
    preset: str


def preset_request_model(name: str, question_names: list[str], example: str) -> type[PresetRequest]:
    """PresetRequest for one preset: `questions` only accepts that preset's names (a dropdown in Swagger)."""

    class WithExample(PresetRequest):
        model_config = ConfigDict(json_schema_extra={"examples": [{"text": example, "min_confidence": 0.8}]})

    return create_model(
        f"{name.capitalize()}PresetRequest",
        __base__=WithExample,
        questions=(Annotated[list[Literal[tuple(question_names)]], Field(min_length=1)] | None, None),
    )


class OracleRequest(BaseModel):
    """Oracle body: only the question. Instructions and answers are fixed, and there is no
    confidence threshold, so `min_confidence`, `text` or `instructions` are a 422."""

    model_config = ConfigDict(
        extra="forbid", json_schema_extra={"examples": [{"question": "¿Me saldrá bien el examen?"}]}
    )

    question: NonEmpty


class YesNoOracleResponse(BaseModel):
    answer: bool
    probability: float
    confidence: float
    model: str
    latency_ms: int


class EightBallPhrase(BaseModel):
    phrase: str
    kind: Literal["affirmative", "non_committal", "negative"]
    percentage: float


class EightBallTotals(BaseModel):
    affirmative: float
    non_committal: float
    negative: float


class EightBallResponse(BaseModel):
    answer: str
    kind: Literal["affirmative", "non_committal", "negative"]
    phrases: list[EightBallPhrase]
    totals: EightBallTotals
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
