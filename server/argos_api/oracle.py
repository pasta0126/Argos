"""Oracle endpoints: the caller sends only a question; the instructions and answers are fixed.

The question is the text Laya reads. Each oracle is one fixed question plus a pure mapping from
the engine's answer to the oracle response (see the add-oracle design: D2-D4).
"""

from typing import Literal

from .schemas import ScoreQuestion, YesNoQuestion

Kind = Literal["affirmative", "non_committal", "negative"]

# The classic Magic 8-Ball phrases in Spanish, most negative first (Laya reads them as an
# ordinal scale). The order is fixed: it is also the tie-break and the order clients show.
PHRASES: list[tuple[str, Kind]] = [
    ("No cuentes con ello", "negative"),
    ("Mi respuesta es no", "negative"),
    ("Mis fuentes dicen que no", "negative"),
    ("Las perspectivas no son muy buenas", "negative"),
    ("Muy dudoso", "negative"),
    ("Respuesta confusa, vuelve a intentarlo", "non_committal"),
    ("Vuelve a preguntar más tarde", "non_committal"),
    ("Mejor no decírtelo ahora", "non_committal"),
    ("No se puede predecir ahora", "non_committal"),
    ("Concéntrate y vuelve a preguntar", "non_committal"),
    ("Las señales apuntan a que sí", "affirmative"),
    ("Buenas perspectivas", "affirmative"),
    ("Lo más probable", "affirmative"),
    ("Tal y como yo lo veo, sí", "affirmative"),
    ("Sí", "affirmative"),
    ("Puedes confiar en ello", "affirmative"),
    ("Sí, definitivamente", "affirmative"),
    ("Es decididamente así", "affirmative"),
    ("Sin lugar a dudas", "affirmative"),
    ("Es cierto", "affirmative"),
]
KINDS: tuple[Kind, ...] = ("affirmative", "non_committal", "negative")

# Two wordings per oracle; `evals/run_oracle.py --wording alt` measures the alternative.
# "default" is the one measured better on 2026-10-02 (server/README.md, oracle evaluation).
YESNO_WORDINGS = {
    "default": "¿La respuesta a esta pregunta es sí?",
    "alt": "Si alguien hiciera esta pregunta, ¿la respuesta sería sí?",
}
EIGHTBALL_WORDINGS = {
    "default": "¿Cómo de probable es que la respuesta a esta pregunta sea afirmativa?",
    "alt": "¿Qué probabilidad hay de que la respuesta a esta pregunta sea sí?",
}

QUESTION_NAME = "oracle"


def yesno_question(wording: str = "default") -> YesNoQuestion:
    return YesNoQuestion(type="yesno", instructions=YESNO_WORDINGS[wording])


def eightball_question(wording: str = "default") -> ScoreQuestion:
    return ScoreQuestion(type="score", instructions=EIGHTBALL_WORDINGS[wording], criteria=[p for p, _ in PHRASES])


YESNO_QUESTION = yesno_question()
EIGHTBALL_QUESTION = eightball_question()


def yesno_answer(answer: dict) -> dict:
    """The engine's yesno answer as the oracle response fields (no low-confidence flag)."""
    probability = answer["probability"]
    return {"answer": probability >= 0.5, "probability": probability, "confidence": answer["confidence"]}


def percentages(probabilities: list[float]) -> list[float]:
    """Probabilities as percentages to 0.1 summing to exactly 100.0 (largest-remainder method)."""
    total = sum(probabilities)
    if total <= 0:
        probabilities, total = [1.0] * len(probabilities), float(len(probabilities))
    raw = [p / total * 1000 for p in probabilities]  # in tenths of a percent
    tenths = [int(r) for r in raw]
    # Hand the missing tenths to the largest remainders; the earliest index wins a tie.
    order = sorted(range(len(raw)), key=lambda i: (-(raw[i] - tenths[i]), i))
    for i in order[: 1000 - sum(tenths)]:
        tenths[i] += 1
    return [t / 10 for t in tenths]


def eightball_answer(answer: dict) -> dict:
    """The engine's 20-level score answer as the 8-Ball response fields.

    The answer is the most likely phrase (earliest on a tie), not Laya's `level`, which
    averages towards the non-committal middle.
    """
    pcts = percentages(answer["probabilities"])
    best = max(range(len(pcts)), key=lambda i: (pcts[i], -i))
    phrase, kind = PHRASES[best]
    tenths = {k: 0 for k in KINDS}
    for (_, k), pct in zip(PHRASES, pcts):
        tenths[k] += round(pct * 10)
    return {
        "answer": phrase,
        "kind": kind,
        "phrases": [{"phrase": p, "kind": k, "percentage": pct} for (p, k), pct in zip(PHRASES, pcts)],
        "totals": {k: t / 10 for k, t in tenths.items()},
    }
