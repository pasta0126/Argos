# Tasks

## 1. Shared decision pipeline

- [x] 1.1 Extract the decide route body (limit check, readiness, gate, engine call, response) in `server/argos_api/main.py` into one internal function used by `/v1/decide`; verify the existing suite passes unchanged (`.venv/bin/python -m pytest`)
- [x] 1.2 Add an optional `preset` field to the request-log line in the logging middleware; verify a test asserts the log line carries the preset name and not the text

## 2. Preset definitions and evaluation

- [x] 2.1 Create `server/argos_api/presets.py` with candidate Spanish versions of Laya's `triage`, `moderation`, `email`, `guard` and `router` presets (English option ids, Spanish instructions/descriptions/levels, no `null` descriptions) built from the existing question models; verify a unit test that every preset validates and has ≤ 10 questions and ≤ 20 options per question
- [x] 2.2 Write `server/evals/presets.jsonl` with labelled Spanish texts meeting the coverage rules in design D6 (≥ 10 texts per question, ≥ 3 true/false per yesno, every option and level at least once), marking ~20 % of lines as held-out; verify a unit test that checks coverage and that every label references an existing preset/question/option
- [x] 2.3 Write `server/evals/run_presets.py` that loads `LayaEngine`, runs each preset over its texts and prints per-question accuracy (tuning and held-out columns), exiting non-zero under 80 %; verify it runs inside the image as `app` against the pinned revision (command documented in the README, same pattern as the model smoke test)
- [x] 2.4 Iterate on wording using only the tuning texts: reword failing questions, drop those still under 80 %, drop presets left empty; verify the final run (including held-out) passes and record per-question accuracy, sample size, date and model revision in `server/README.md`

## 3. Preset endpoints

- [x] 3.1 Add `GET /v1/presets` (auth required, works while loading) returning `presets` → `description` + `questions` in `/v1/decide` format; verify tests for 200 + shape, 401 without key, 200 while loading, and that each listed preset's questions are accepted by `/v1/decide`
- [x] 3.2 Add `POST /v1/presets/{name}` with body `{text, min_confidence?, questions?}` (extra fields forbidden) using the shared pipeline and adding `preset` to the response; verify tests for full preset, subset, `low_confidence`, 404 unknown preset, 422 unknown subset name / empty subset / malformed body, 413 long text, 401, 503 loading and 503 busy
- [x] 3.3 Run the real-model smoke test against one preset inside the image (extend the `-m model` test); verify it passes

## 4. Documentation and client material

- [x] 4.1 Document both endpoints in `server/README.md` (API section, preset list with question counts and latency, eval command in the Laya upgrade notes); verify the documented curl commands run against a local or deployed instance
- [x] 4.2 Add a "Presets" section and an example to `server/TESTING.md` and a `server/examples/preset-*.json` body; verify the curl in the guide returns the documented result
- [x] 4.3 Add a `Presets` folder to `server/postman/argos.postman_collection.json` (list, one run per published preset with expected-result tests, 404 and 422 cases); verify `npx -y newman run` passes with every assertion green

## 5. Release

- [x] 5.1 Deploy on void-server (`docker compose up -d --build`), wait for the model, and verify the newman collection passes against `https://argos.northernarchive.com`
- [x] 5.2 Commit, tag `v0.2.0` and push; verify the tag is on origin
