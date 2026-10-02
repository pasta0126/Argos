# Design

## Context

`main.py` sends every decision through `run_decision(DecideRequest, request)`, which applies the
size limits, readiness, the one-at-a-time `InferenceGate` and `engine.decide`. Presets are
`DecideRequest`s whose questions are fixed in `presets.py`. The engine protocol and
`laya_engine.py` already translate `yesno` and `score` questions. The web wizard builds
every request through `buildRequest(draft)` in `web/src/lib/draft.js`, and the mode step
(`ModeStep.jsx`) lists the custom and preset cards.

Measured on 2026-10-02 against the live service (Pi, revision `55cf4c4e`), through `/v1/decide`:

- One `yesno` question: ~1–1.5 s.
- The 20-phrase `score` scale: ~9 s (11 s together with two yes/no questions). The wizard's
  estimate formula (`0.4 + 0.15·k²`) predicts 60 s for it, so the oracle needs its own
  estimate.
- On "¿Me tocará la lotería este año?" the scale spread out (max 12.7 %, "Sin lugar a dudas"),
  rather than collapsing to the middle as the 3–4 level preset scales do.
- Laya could not tell yes/no questions from open ones, with either of two wordings tried (see
  proposal). The owner decided not to check this at all: D2.

## Goals / Non-Goals

**Goals:**
- Two oracle endpoints built on the existing decision pipeline, with no change to the engine
  protocol, `/v1/decide` or the presets.
- A wizard path to them that feels different (themed) but reuses the steps, payload preview,
  progress, retry and error handling.

**Non-Goals:**
- Randomness: the same question gets the same answer (Laya is deterministic). It is an oracle
  with a fixed opinion, not a dice roll.
- Checking whether a question is a yes/no question.
- Listing the oracles under `GET /v1/presets` or making them customisable.

## Decisions

### D1. Oracles are fixed questions through `run_decision`
New `oracle.py` holds the two fixed `Question`s and the pure mapping from the engine's answers
to the oracle response. Each route does four things: check the 500-character limit (`413`),
build `DecideRequest(text=question, questions={...}, min_confidence=None)`, call
`run_decision`, and map the result. A `JSONResponse` result (`413`/`503`) passes through
unchanged. Gate, readiness and logging come for free.
*Alternative:* a separate engine method. Rejected: it duplicates the queue and readiness logic
for no gain.

### D2. Yes/no oracle: one `yesno` question, no applicability check
Fixed instruction (Spanish), for example "¿La respuesta a esta pregunta es sí?", optionally with
`yes`/`no` criteria. The wording is the better of two tried with the D7 report, not tuned per
question. The response is `answer`, `probability`, `confidence`, `model` and `latency_ms`.
Laya's yes/no detection was wrong on 3 of 5 obvious cases, so the owner moved that job to
the caller. The wizard says so in a hint.
*Alternatives:* a Spanish-interrogative rule check, or Laya plus rules. Both were offered;
the owner declined.

### D3. 8-Ball: one 20-level `score` question; the answer is the most likely phrase
The question is the text. A fixed instruction such as "¿Qué probabilidad hay de que la
respuesta a esta pregunta sea sí?" scores it on the scale below, most negative first (the
Spanish wording of the classic phrases):

| # | phrase | kind |
|---|---|---|
| 0 | No cuentes con ello | negative |
| 1 | Mi respuesta es no | negative |
| 2 | Mis fuentes dicen que no | negative |
| 3 | Las perspectivas no son muy buenas | negative |
| 4 | Muy dudoso | negative |
| 5 | Respuesta confusa, vuelve a intentarlo | non_committal |
| 6 | Vuelve a preguntar más tarde | non_committal |
| 7 | Mejor no decírtelo ahora | non_committal |
| 8 | No se puede predecir ahora | non_committal |
| 9 | Concéntrate y vuelve a preguntar | non_committal |
| 10 | Las señales apuntan a que sí | affirmative |
| 11 | Buenas perspectivas | affirmative |
| 12 | Lo más probable | affirmative |
| 13 | Tal y como yo lo veo, sí | affirmative |
| 14 | Sí | affirmative |
| 15 | Puedes confiar en ello | affirmative |
| 16 | Sí, definitivamente | affirmative |
| 17 | Es decididamente así | affirmative |
| 18 | Sin lugar a dudas | affirmative |
| 19 | Es cierto | affirmative |

The order inside a class is a judgment call. It only matters for Laya's ordinal reading and
for tie-breaking. The answer is the argmax of `probabilities` (earliest index on a tie). It is
not Laya's `level` (nearest to the expected score), because averaging over 20 levels pulls
towards the non-committal middle, and the middle is the least fun answer. 20 levels is exactly
`MAX_OPTIONS`.
*Alternative:* `choice` over the 20 phrases. Rejected: the owner asked for a scale, and choice
keys would have to be slugs.

### D4. Percentages: largest-remainder rounding to one decimal
`percentage = probability × 100`, rounded to 0.1 with the largest-remainder method so the 20
values sum to exactly 100.0 (Laya's probabilities are themselves rounded to 4 decimals).
`totals` sums the rounded percentages per kind, so totals and bars always agree.

### D5. Schemas and limits
`OracleRequest` has only `question: NonEmpty` and `extra="forbid"`, so `min_confidence`,
`text` and `instructions` get a standard `422` that names the field. `MAX_QUESTION_CHARS = 500`
is checked in the route (`413`), kept out of Pydantic as with the other limits. The response
models are `YesNoOracleResponse` and `EightBallResponse` (`phrases: list[{phrase, kind,
percentage}]`, `totals: {affirmative, non_committal, negative}`). Routes are under
`/v1/oracle/`, tagged `oracle`, with a request example.

### D6. Logging
The access log already records method, path, status and latency. Oracle routes set
`question_count` (1) like the other routes. They do not set `preset`, so the path identifies
them. The question is never logged.

### D7. Evaluation as a report: `evals/oracle.jsonl` + `evals/run_oracle.py`
At least 30 Spanish questions (no labels needed): mostly yes/no, with a few open ones. The
script loads `LayaEngine` like `run_presets.py` and prints the share of yes answers, the
P(yes) quartiles, and win counts per 8-Ball phrase and kind. It always exits 0. It is used once
to choose between two wordings for each oracle instruction (D2, D3) and rerun after model or
`laya` changes. `--wording` selects the alternative.

### D8. Wizard: an `oracle` mode in the same steps
- Draft: `mode: 'oracle'` plus `oracleName: 'yesno' | '8ball'`. The text is reused as the
  question. `minConfidence` is left untouched, so going back to custom restores the user's
  setting. `buildRequest` returns `{path: '/v1/oracle/<name>', body: {question: text}}` and
  never adds `min_confidence` in oracle mode.
- Mode step: a second section after the existing grid, with its own heading ("Oráculo") and
  the `.oracle` theme. It shows two cards with endpoints.
- Text step: label "Pregunta", limit 500 from `limits.js`, and the yes/no hint for `yesno`.
- Questions step: a read-only explanation of the fixed instruction (and the 20 phrases for
  the 8-Ball).
- Options step: checkbox unchecked and disabled, with a note.
- Results: `OracleYesNo` (big Sí/No, P(yes) bar) and `Oracle8Ball` (a dark "ball" with the
  winning phrase, 20 bars coloured by kind, three totals). The payload, response and curl tabs
  stay as they are.
- Expected duration: fixed per oracle from the measurements (yes/no ≈ 2 s, 8-Ball ≈ 10 s)
  instead of the k² formula.
- Theme: `.oracle` scope tokens (deep indigo/violet surface, gold accent, kind colours) defined
  for light and dark in `styles.css`, the same way as the existing `:root` tokens. Text
  contrast is checked in both themes.

## Risks / Trade-offs

- [Callers ask open questions and get a meaningless sí/no] → Documented in `API.md`, the
  README and the wizard hint. The owner accepted it.
- [The 8-Ball answer is the most likely phrase but often holds only ~10–15 %] → All 20
  percentages and the class totals are returned, so clients can show how sure the ball is.
  Nothing is hidden.
- [~9 s per 8-Ball call holds the single inference slot] → Same order as a full preset.
  Callers queue behind it (bounded, `503 busy` beyond `ARGOS_MAX_QUEUE`), and the wizard shows
  an honest estimate.
- [Laya may lean to "yes" or to one phrase for most questions] → The D7 report shows the
  answer spread. It is a toy, so this is reported, not gated.
- [`FakeEngine` returns only 3 score probabilities] → Make it return one per level so the
  20-phrase mapping is tested.

## Migration Plan

Additive. Deploy the API first (`docker compose up -d --build` in `server/`), check
`/openapi.json` and the curl examples. Then build and deploy `web/`, which needs the new
endpoints. Tag the next minor version. Rollback: redeploy the previous tag of both. Older
clients are unaffected.
