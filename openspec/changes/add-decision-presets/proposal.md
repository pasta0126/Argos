# Proposal

## Why

Every caller of `POST /v1/decide` has to write its own questions, and our tests show that
wording decides accuracy (5-level star scales biased low, "¿necesita respuesta?" answered
`false` at 0.96 for an email that asks a direct question). Laya ships tuned question sets for
common jobs (ticket triage, moderation, email, LLM input guarding, LLM request routing), but
in English and only as a Python API. Exposing **validated, Spanish presets** lets clients
get a useful decision by sending only the text, and gives us one place to fix wording.

## What Changes

- `GET /v1/presets` — lists the available presets and, for each, its questions (name, type,
  instructions, options), so callers know what they will get back.
- `POST /v1/presets/{name}` — body `{text, min_confidence?, questions?}`; answers the preset's
  questions (or the requested subset) with exactly the same answer shapes as `/v1/decide`,
  plus the `preset` name. Same auth, limits, concurrency and log privacy as `/v1/decide`.
- Presets are Argos-owned Spanish adaptations of Laya's presets. A preset question is only
  published if it meets an accuracy bar on a labelled Spanish evaluation set kept in the
  repo; questions that fail are reworded or dropped, and a preset left with no question is
  not published. Outcome of the evaluation (design D8): **`triage`** (`intent`,
  `refund_requested`, `churn_risk`) and **`guard`** (`jailbreak`, `prompt_injection`,
  `sensitive_data`) — 6 of 24 candidate questions. Laya's `email`, `moderation` and
  `router` presets and every score question failed.
- Docs, Postman collection and `TESTING.md` gain the preset endpoints.

Evaluated and **not** included (numbers in `design.md`):
- Batch endpoint (`decide_batch`): ~3–7 % faster per text on the Pi, while one batch would
  hold the single inference slot for 20 s+.
- Language detection (`detect_language`): only es/pt/fr/en are recognised; German, Italian,
  Catalan, Basque, Russian, Chinese… return `null`.

## Capabilities

### New Capabilities
- `decision-presets`: named, ready-made question sets — listing them, running one (or a
  subset of its questions) over a text, and the quality bar a preset question must meet.

### Modified Capabilities
<!-- none: /v1/decide is unchanged. Its spec (decision-api) is still in the unarchived
     add-laya-api change; this change only references its answer shapes. -->

## Impact

- **Code**: `server/argos_api/` gains preset definitions, two routes and their request
  model; the engine, gate, auth and limits are reused unchanged.
- **Repo**: a labelled Spanish evaluation set and a script that runs it against the real
  model (inside the image, like the existing model smoke test).
- **Clients/docs**: README, `TESTING.md`, `examples/`, Postman collection.
- **Host**: no new memory or dependencies; a preset call costs ~1 s per question (2–3
  questions per published preset).
- **Dependency on add-laya-api**: that change should be archived first so `decision-api`
  exists in `openspec/specs/` when this one is archived.
