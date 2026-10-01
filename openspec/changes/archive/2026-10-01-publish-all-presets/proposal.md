# Proposal

## Why

Only `triage` (3 questions) and `guard` (3 questions) are published, because the
`add-decision-presets` evaluation kept just the questions that reached 80 % balanced accuracy.
The API owner wants every Laya preset available as a ready-made endpoint, complete, so clients
can use and judge them on their own texts, presented the same way as `triage` and `guard`.

## What Changes

- Publish all five Laya presets complete, in Spanish, each with its own documented endpoint
  (from `add-preset-endpoints`) and an example text:
  - `triage`: + `is_urgent`, `frustration` (5 questions)
  - `guard`: + `harm_severity`, `topic` (5 questions)
  - `email` (new): `category`, `is_spam`, `is_phishing`, `urgency`, `needs_reply`
  - `moderation` (new): `toxic`, `harassment`, `threat`, `spam`, `severity`
  - `router` (new): `difficulty`, `domain`, `needs_tools`, `is_sensitive`
- **Drop the 80 % publication gate.** The evaluation stays as an informative report that
  records accuracy per question; it no longer decides what is published.
- No accuracy disclaimers in the endpoint descriptions or in `API.md`'s preset sections; the
  measured numbers stay in `server/README.md` for maintainers.
- The evaluation set gets back the labels for every question.
- **Swagger "Authorize" button**: the OpenAPI description declares the bearer API key, so
  calls can be made from `/docs` after pasting the key once. Today it is missing (the docs
  told users to press a button that does not exist); README, TESTING.md and API.md are fixed.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `decision-presets`: the "Spanish, validated questions" requirement is replaced by
  "Spanish preset questions" plus a recorded (non-gating) evaluation.
- `api-access`: adds a requirement that the API description declares the bearer key scheme
  on every `/v1/*` operation (and not on `/health`).

## Impact

- **Code**: `server/argos_api/auth.py` (bearer scheme declared in OpenAPI, same 401
  behaviour), `server/argos_api/presets.py` (three new presets, four new questions in the
  existing ones), `server/evals/` (labels restored, report-only exit code), tests.
- **API**: three new endpoints (`/v1/presets/email`, `/moderation`, `/router`); `triage` and
  `guard` return more answers by default and take longer (~1 s per extra question:
  `triage` ≈ 7–8 s, `guard` ≈ 5 s). Existing fields are unchanged; clients that want the old
  behaviour can pass `questions`.
- **Quality**: published questions include ones measured well under 80 % in Spanish (e.g.
  `email.is_phishing` 56 %, every score question ≤ 45 %); see design D3. Accepted by the owner.
- **Docs**: API.md, TESTING.md, README, Postman. Release `v0.4.0`.
- **Order**: archive `add-preset-endpoints` before this change.
