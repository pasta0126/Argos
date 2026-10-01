# Design

## Context

`server/argos_api/presets.py` publishes `triage` (intent, refund_requested, churn_risk) and
`guard` (jailbreak, prompt_injection, sensitive_data). Each preset gets its own endpoint
automatically (`add-preset-endpoints`, not yet archived). The full candidate wording for all
24 questions, and three evaluation rounds over them, are recorded in
`openspec/changes/archive/2026-10-01-add-decision-presets/design.md` (D8): a first Spanish
translation (v1), Laya's English, and a reworded Spanish version (v2: explicit yes/no criteria,
3-level scales). `evals/presets.jsonl` now only holds labels for the six published questions.

## Goals / Non-Goals

**Goals:**
- All five presets, complete, as endpoints identical in shape to `triage` and `guard`.
- Use, per question, the Spanish wording that measured best, so publishing everything does not
  also mean publishing the worst variant.

**Non-Goals:**
- New rewording rounds or a bigger evaluation set.
- English wording (presets stay Spanish).

## Decisions

### D1. Wording per question: the better of v1 and v2
Published wording keeps v2 where it already is (`triage.intent`) and otherwise takes the
better-measured variant (balanced accuracy where available, else plain):

| preset | v2 | v1 (first translation) |
|---|---|---|
| triage | `intent` | `is_urgent`, `frustration` (4 levels), `refund_requested`, `churn_risk` |
| guard | `harm_severity` (3 levels), `topic` | `jailbreak`, `prompt_injection`, `sensitive_data` |
| email | — | all five (v2 was worse or equal on each) |
| moderation | — | all five (v2 was worse or equal on each) |
| router | — | all four (`difficulty` 4 levels; `domain` tied, v1 kept) |

Option ids stay English as today. Each new preset gets a Spanish `description` and an `example`
text for its endpoint.

### D2. Evaluation becomes a report
`evals/presets.jsonl` gets back the labels for every question (the original 86-text set, with
the scale labels of `guard.harm_severity` mapped to its 3 levels). `run_presets.py` keeps the
same table (accuracy, balanced accuracy, per-class recall) and marks questions under 80 %, but
always exits 0. The coverage unit test keeps checking that every published question has at
least 10 labels and every option/level/answer represented.

### D3. No disclaimers in the API surface; numbers kept for maintainers
Endpoint descriptions, `GET /v1/presets` and the preset sections of `API.md` describe what each
preset answers, like `triage` and `guard` today, without accuracy notes. `server/README.md`
keeps the per-question accuracy table (now for all 24 questions) because it is the only record
of how each question performed and what to re-measure after a Laya upgrade. Documented
facts that would now be false (e.g. "each published question reached 80 %") are removed.

### D4. Bearer scheme in OpenAPI without changing auth behaviour
`require_api_key` takes `fastapi.security.HTTPBearer(auto_error=False)` as a sub-dependency.
That makes FastAPI declare an `http`/`bearer` security scheme and attach it to every operation
that depends on `require_api_key` (all `/v1/*`), which is what renders Swagger's **Authorize**
button and sends the header on "Try it out". With `auto_error=False` the scheme never raises by
itself, so missing/invalid keys still get our `401` + `WWW-Authenticate: Bearer` and the
constant-time comparison stays as is. `/health` does not depend on it and stays public.
*Alternative:* add `securitySchemes` by overriding `app.openapi()`. Rejected: hand-maintained
schema that can drift from the real dependency.

## Risks / Trade-offs

- [Clients trust low-accuracy answers (e.g. `email.is_phishing` flagged ordinary mail at 1.00,
  score questions mostly answer the middle level)] → Accepted by the owner; numbers in the
  README; `min_confidence` and the `questions` subset remain available.
- [`triage`/`guard` responses grow and get slower by default] → Callers can pass `questions` to
  keep the previous set; documented in API.md.
- [Removing the gate lets quality regress unnoticed after a Laya upgrade] → The report is still
  in the upgrade checklist; it now informs instead of blocking.

## Migration Plan

Deploy with `docker compose up -d --build`, run the Postman collection, tag `v0.4.0`.
Rollback: redeploy `v0.3.0`.
