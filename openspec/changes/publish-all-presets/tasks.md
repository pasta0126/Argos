# Tasks

## 1. Presets and evaluation

- [x] 1.1 Add the missing questions to `triage` and `guard` and the `email`, `moderation` and `router` presets to `server/argos_api/presets.py` with the wording chosen in design D1, a Spanish description and an example text each; verify `tests/test_presets.py` (valid requests, ≤ 10 questions, ≤ 20 options) passes for all five presets
- [x] 1.2 Restore the labels of every question in `server/evals/presets.jsonl` (original set, `guard.harm_severity` mapped to 3 levels) and make `run_presets.py` always exit 0 while still marking questions under 80 %; verify the coverage test passes and the report runs inside the image over all five presets
- [x] 1.3 Update API tests that assume only `triage` and `guard` (listing, OpenAPI operations); verify `.venv/bin/python -m pytest` passes and `/openapi.json` lists the five per-preset operations

## 2. Swagger authorization

- [x] 2.1 Declare the bearer scheme through `HTTPBearer(auto_error=False)` in `require_api_key` without changing its 401 behaviour; verify tests: `/openapi.json` has an `http`/`bearer` security scheme referenced by every `/v1/*` operation and not by `/health`, and the existing auth tests (missing header, wrong key, 401-before-422) pass unchanged
- [x] 2.2 After deploying, verify in `/openapi.json` that the scheme is present and that a "Try it out"-style request with the header works; fix the Authorize instructions in `server/README.md`, `server/TESTING.md` and `server/API.md`

## 3. Documentation

- [x] 3.1 Update `server/API.md` (endpoint list, presets table with all questions, one request/response example per new preset from real calls, remove the "80 %" statement and the presets limitations list), `server/TESTING.md` and `server/README.md` (preset list; per-question accuracy table for all 24 questions from the report; no publication gate); verify documented JSON matches real calls against the deployed service
- [x] 3.2 Add a request per new preset to the Postman `Presets` folder and update the listing test; verify `npx -y newman run` passes against the deployed service

## 4. Release

- [x] 4.1 Deploy on void-server and verify `/docs` lists the five preset endpoints and the newman run passes
- [x] 4.2 Commit, tag `v0.4.0` and push; verify the tag is on origin
