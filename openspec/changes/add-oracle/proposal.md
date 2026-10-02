# Proposal

## Why

Argos only answers questions *about* a text that the caller supplies. The owner wants a
playful "oracle": the caller sends only a question and gets an answer. One endpoint gives a
plain yes or no. The other answers
like a Magic 8-Ball, with the classic phrases and a percentage for each one. Both reuse the
Laya engine that is already deployed. The question is used as the text and the instructions
are fixed.

## What Changes

- New `POST /v1/oracle/yesno`: body `{"question": "..."}`. The question is the text; a fixed
  Spanish instruction asks whether the answer is yes. Returns a boolean `answer`, its
  `probability` and `confidence`. It always answers. Asking a yes/no question is the
  caller's job, because Laya cannot reliably tell yes/no questions from open ones (measured on
  2026-10-02: "¿Por qué el cielo es azul?" scored 0.79–0.89 as a yes/no question).
- New `POST /v1/oracle/8ball`: body `{"question": "..."}`. The question is the text; a
  fixed instruction scores it on a scale made of the 20 classic Magic 8-Ball phrases in Spanish
  (most negative first, most affirmative last). Returns the winning phrase, every phrase with
  its percentage (summing to 100), and the totals for affirmative, non-committal and negative.
  It always answers; it does not reject questions that are not yes/no questions.
- The oracle has no low-confidence threshold: it does not accept `min_confidence` (`422`) and
  never returns `low_confidence`.
- Same auth, `503` while loading or busy, shared one-at-a-time inference queue and
  content-free logging as the rest of the API. Questions are limited to 500 characters (`413`).
- A Spanish question set and a report on the oracle's answers: the share of yes answers and
  how often each 8-Ball phrase wins, to catch an oracle that always says the same. Not a
  release gate.
- `API.md` and `server/README.md` document both endpoints with real examples.
- Web wizard: on the mode step, the two oracles appear as a separate group under the custom and
  preset cards, with their own mystic visual theme. In oracle mode the text step asks for the
  question (500-character limit) and the questions step shows the fixed oracle question as
  read-only. The low-confidence option is always unchecked and disabled. Results get themed
  views: a big Sí / No, and an 8-Ball with the winning
  phrase, a bar for every phrase and the class totals.

## Capabilities

### New Capabilities
- `oracle`: question-only endpoints that answer with yes/no or with Magic 8-Ball phrases and
  their percentages.

### Modified Capabilities
- `web-wizard`: adds the oracle group on the mode step and the themed oracle result views. In
  oracle mode the text step has a 500-character limit and the low-confidence option is always
  off. `/v1/decide`, the presets and their API specs are unchanged.

## Impact

- Code: new `server/argos_api/oracle.py` (fixed questions, phrase list, answer mapping), new
  routes in `main.py`, request/response models in `schemas.py`. No change to the engine
  protocol or to `laya_engine.py`.
- API: two new additive endpoints under `/v1/oracle/`, tagged `oracle` in OpenAPI. They are
  not listed in `GET /v1/presets`.
- Evals: `server/evals/oracle.jsonl`, `server/evals/run_oracle.py`.
- Docs: `server/API.md`, `server/README.md`, `server/TESTING.md`, Postman collection.
- Web: `web/src` mode step, draft/request building, validation, answer views, styles (oracle
  theme tokens for light and dark), `web/README.md`.
- Performance (measured on the Pi through `/v1/decide`): one yes/no question takes ~1–1.5 s. The
  20-phrase scale takes ~9 s, which is about the cost of a full preset.
