# Tasks

## 1. Oracle core (server)

- [x] 1.1 Create `server/argos_api/oracle.py`: the fixed yes/no question, the 20-phrase scale with kinds (design D3 table), and pure mapping functions (yes/no answer; 8-Ball argmax with earliest-index tie-break, largest-remainder percentages to 0.1, class totals). Verify with new `tests/test_oracle.py` unit tests: 20 phrases split 10/5/5, percentages sum to exactly 100.0, a tie picks the lower index, totals equal the sum of their phrases
- [x] 1.2 Add `OracleRequest` (`question` only, `extra="forbid"`), `MAX_QUESTION_CHARS = 500`, `YesNoOracleResponse` and `EightBallResponse` to `schemas.py`, and make `FakeEngine` return one score probability per level. Verify with the existing suite (`.venv/bin/python -m pytest`) still green

## 2. Oracle endpoints (server)

- [x] 2.1 Register `POST /v1/oracle/yesno` and `POST /v1/oracle/8ball` in `main.py` (tag `oracle`, summary, Spanish description, request example) through `run_decision`, with the 413 check and `question_count`. Verify with `tests/test_oracle_api.py`: 200 shapes for both, no `low_confidence`, `min_confidence`/`text` → 422 naming the field, empty question → 422, 501 chars → 413, no key → 401, loading → 503 + `Retry-After`, engine called with the question as text and no threshold, both in `/openapi.json`, absent from `GET /v1/presets`, and log lines without the question
- [x] 2.2 Add `evals/oracle.jsonl` (≥ 30 Spanish questions, mostly yes/no plus a few open ones) and `evals/run_oracle.py` (share of yes answers, P(yes) quartiles, win counts per phrase and kind, `--wording` for the alternative, exit 0). Verify with a test that the set has ≥ 30 non-empty questions, then run it inside the image and keep the better wording for each instruction in `oracle.py`
- [x] 2.3 Document the oracle in `server/README.md` (endpoints, the measured latencies, the "caller asks yes/no questions" caveat, the eval command and its results), `server/API.md` (Spanish section with request/response examples taken from real calls after deploy, errors), `server/TESTING.md` and the Postman collection. Verify every documented curl matches a real call against the deployed service (after 4.1)

## 3. Wizard oracle mode (web)

- [x] 3.1 Draft and request: `mode: 'oracle'` + `oracleName`, a `chooseOracle` reducer action that keeps `minConfidence`, a `buildRequest` branch (`/v1/oracle/<name>`, body `{question}` only), a 500-char limit in `limits.js`/`validate.js`, and a fixed expected duration per oracle. Verify with `npm test` (new cases in `draft.test.js`, `reducer.test.js`, `validate.test.js`: exact oracle payload, no `min_confidence` even when set, flag restored when going back to custom, 501 chars blocked)
- [x] 3.2 Mode step oracle group with the `.oracle` theme (light and dark tokens in `styles.css`). Text step: "Pregunta" label, 500 counter and the yes/no hint. Questions step: read-only oracle explanation. Options step: checkbox unchecked and disabled with a note. Verify with `npm run lint`, `npm test` and a Playwright check in light and dark of the mode step, an oracle text step and the options step
- [x] 3.3 Result views `OracleYesNo` and `Oracle8Ball` (themed; payload/response/curl tabs unchanged) wired into `ResultView`. Verify with `answerView` unit tests using fixture responses (Sí/No and percentage, 20 bars in order coloured by kind, totals) and a Playwright screenshot of each result in both themes against the deployed API
- [x] 3.4 Update `web/README.md` with the oracle mode. Verify `npm run build` succeeds

## 4. Release

- [x] 4.1 Deploy the API, check `/docs` lists both oracle operations, and record the real request/response examples for `API.md` (2.3). Then deploy `web/` and run one yes/no and one 8-Ball request end to end in the wizard
- [x] 4.2 Commit, tag the next minor version (`v0.6.0`) and push. Verify the tag is on origin
