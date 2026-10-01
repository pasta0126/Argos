# Design

## Context

- `POST /v1/decide` (change `add-laya-api`, deployed as v0.1.x) is the only decision route.
  The route validates (`DecideRequest`, `limit_violation`), waits on the shared
  `InferenceGate`, calls `DecisionEngine.decide(text, questions, min_confidence)` and logs
  metadata only. `LayaEngine` translates Argos questions to Laya (`yesno` → `noul`, etc.).
- Laya 0.3.22 ships five preset question sets as plain dicts: `triage_questions()`,
  `moderation_questions()`, `email_questions()`, `guard_questions()`, `router_questions()`.
  They are in English, use Laya's wire format (`noul`, `true`/`false` criteria keys), refer to
  named state fields in backticks (`` `message` ``, `` `post` ``, `` `body` ``), and
  `guard.topic` has options with `null` descriptions.
- Measured on void-server on 2026-10-01 (multilingual checkpoint, revision `55cf4c4e`):
  - Spanish texts, English vs our Spanish wording of the same questions: triage 6/8 vs 6/8,
    moderation 4/6 vs 5/6. Both missed "te parto la cara" as a threat (conditional) and
    "demo mañana a las 9, ¡arreglarlo YA!" as urgent (0.998 confident `false` in English).
  - Batch: 8 texts × 3 questions, sequential `predict` 21.1 s vs `decide_batch` 20.4 s
    (1 text: 2.70 s vs 2.85 s; 4 texts: 10.8 s vs 10.1 s). Peak RSS 2.5 GB.
  - `detect_language`: `es`, `pt`, `fr`, `en` recognised; `de`, `it`, `ca`, `eu`, `ru`, `zh`
    and one-word texts → `language: null` (script is always detected).
- Requirements: `specs/decision-presets/spec.md`.

## Goals / Non-Goals

**Goals:**
- Preset routes that reuse the decide pipeline exactly (auth, limits, gate, logging, answer
  shapes), so there is one code path to keep correct.
- Preset wording that is measured, not assumed: an evaluation set in the repo decides what
  gets published and is rerun whenever Laya or the checkpoint changes.

**Non-Goals:**
- User-defined or saved presets (presets are code, changed through OpenSpec).
- Structured state (separate `subject`/`body` fields): presets take a single `text`, like
  `/v1/decide`.
- English presets or per-request language selection.

## Decisions

### D1. Presets are Argos-owned definitions, not read from Laya at runtime
A `presets` module declares each preset as a description plus a dict of the existing
`ChoiceQuestion` / `ScoreQuestion` / `YesNoQuestion` models, written in Spanish and adapted
from Laya's sets.
*Alternative:* call `laya.triage_questions()` etc. and translate the format on the fly.
Rejected: English wording, Laya's format quirks (`noul`, `null` criteria, backticked field
names) would leak, a Laya upgrade could silently change a public preset, and the HTTP layer
would need to import Laya (today only `laya_engine.py` does). Using the request models means
the engine, the adapter and `FakeEngine` need no change, and `GET /v1/presets` can serialise
them in exactly the format `/v1/decide` accepts.

### D2. Choice labels stay English identifiers; everything read by humans is Spanish
Option keys keep Laya's snake_case English ids (`refund`, `technical_help`) — they are what
clients branch on, and Laya reads them as semantic labels. Instructions, option descriptions
and score levels are Spanish (score `level` is returned verbatim, as in `/v1/decide`).
*Alternative:* Spanish keys (`reembolso`). Rejected: clients' code would depend on accents and
on our translation choices; the measured runs used English keys with Spanish descriptions
and chose correctly.

### D3. One internal pipeline for decide and presets
Extract the body of the decide route (limit check → readiness → gate → engine → response)
into a shared function; `/v1/decide` and `/v1/presets/{name}` both call it, and the preset
route only resolves the preset, applies the `questions` subset and adds `preset` to the
response. The logging middleware gains a `preset` field (name only).
*Alternative:* the preset route builds a `DecideRequest` and calls the decide handler.
Rejected: couples routes through FastAPI handler signatures; a plain function is easier to
test and read.

### D4. `GET /v1/presets` is static and authenticated
It serialises the definitions without touching the engine, so it answers while the model
loads. It sits under `/v1/` and requires a key like every `/v1/*` route.

### D5. Optional `questions` subset
A preset call costs ~1 s per question and holds the single inference slot (triage: 5
questions ≈ 5 s). Callers that need one answer send `questions: ["toxic"]`. Unknown names
are `422` (body problem); unknown preset is `404` (resource problem).

### D6. Evaluation set decides what is published
`server/evals/presets.jsonl`: one line per text with `preset`, `text` and the expected
answer per question (choice label, score level index, yesno boolean). Coverage per question:
at least 10 texts; every yesno question at least 3 `true` and 3 `false`; every choice option
and score level at least once. Texts are written for the purpose (no customer data).
A script (`server/evals/run_presets.py`) loads the real engine, runs every preset over its
texts and prints per-question accuracy and balanced accuracy (mean recall per expected
answer); it exits non-zero if a published question's balanced accuracy is under 80 %. Score answers count as correct when the returned `level` equals the expected level.
Process: start from a Spanish wording of Laya's question, run, reword failing questions
(concrete, about the text, short scales — lessons from `TESTING.md`), and drop a question
still under the bar. A preset with no surviving question is not published. Results (accuracy
per question, date, model revision) go in `server/README.md`.
*Alternative:* ship Laya's presets unvalidated with a disclaimer. Rejected: the point of a
preset is that the wording has been checked; the baseline already shows confident misses.

### D7. Batch and language detection rejected (for now)
See Context numbers. Batching gives ≤7 % per text on this CPU and would block other callers
for the length of the batch; a client loop over `/v1/decide` performs the same. Language
detection is a stopword heuristic for choosing between Laya checkpoints, which Argos does not
do; exposing it would promise more than it delivers. Revisit batching if Argos moves to
hardware where batching pays off.

### D8. Evaluation outcome (2026-10-01, revision `55cf4c4e`, 86 texts)
Three rounds over the same set: a first Spanish wording, Laya's original English questions
(non-score only), and a reworded Spanish version (explicit yes/no criteria, non-overlapping
choice descriptions, 3-level scales). Published, Spanish wording:

| preset | question | accuracy | balanced | positives found |
|---|---|---|---|---|
| triage | intent | 13/14 (93 %) | 83 % | `other` 0/1, rest all |
| triage | churn_risk | 14/14 (100 %) | 100 % | 3/3 |
| triage | refund_requested | 13/16 (81 %) | 88 % | 4/4 |
| guard | jailbreak | 16/18 (89 %) | 93 % | 3/3 |
| guard | prompt_injection | 17/19 (89 %) | 94 % | 3/3 |
| guard | sensitive_data | 17/21 (81 %) | 89 % | 3/3 |

The bar was first plain accuracy; `router.needs_tools` and `router.is_sensitive` passed it
at 13/16 (81 %) while missing all 3 `true` texts — they answer `false` to almost
everything. The bar is now balanced accuracy (both at 50 %), and `router` is not published.

Not published, with best score across rounds: every score question (≤ 45 %, answers cluster
on a middle level with 4 or 3 levels), all of `email` (category ≤ 59 %, `is_phishing` flags
ordinary mail at 1.00), `moderation` toxic/harassment/spam (≤ 71 %) and threat (73 % es,
80 % en: misses conditional and veiled threats), `guard.topic` (≤ 60 %), `router` (difficulty,
`domain` 79 % es / 93 % en, and `needs_tools`/`is_sensitive`, see above) and `triage.is_urgent` (69 % es, 81 % en). English-only
passes are not published because presets must be Spanish.
Rewording did not reliably help: `intent` went 79 → 93 %, but `moderation.spam` 67 → 40 % and
`email.is_phishing` 56 → 31 %. The held-out split was not consulted for rewording, but its
counts were printed with every run, so it is weaker evidence than intended. Margins are thin
(13/16 = 81 %; one more miss fails): the README publishes accuracy with sample sizes.
Known false positives in published questions: `jailbreak` and `prompt_injection` flag
messages that only contain personal data; `sensitive_data` flags jailbreak attempts.

## Risks / Trade-offs

- [Small, self-written evaluation set overstates accuracy] → Publish the numbers with the
  sample size; add real (anonymised) misses to `presets.jsonl` as they are reported; the bar
  is per question, not averaged per preset.
- [Laya or checkpoint upgrade changes preset behaviour] → The eval script is part of the
  upgrade checklist in the README; the model revision stays pinned.
- [Long presets block other callers for several seconds] → Subset parameter; README and
  `GET /v1/presets` make the question count visible; gate and queue limits unchanged.
- [Rewording to pass the set overfits it] → Keep a few texts out while rewording and run them
  only for the final check (recorded as a held-out column in the eval output).

## Migration Plan

Additive: new routes only, `/v1/decide` unchanged. Deploy with the usual
`docker compose up -d --build`; tag `v0.2.0`. Rollback: redeploy `v0.1.1`.
