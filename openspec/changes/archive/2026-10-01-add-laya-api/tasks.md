# Tasks

## 1. Spike: Laya on the Pi

- [x] 1.1 In a throwaway `python:3.12-slim` container on `void-server`, `pip install laya==<latest>`, load `subfolder="multilingual"`, and record install size, load time, resident RAM and p50/p95 latency for 1 and 3 questions on Spanish text; verify by writing the numbers into `server/README.md` (section "Performance on void-server")
- [x] 1.2 Record the Laya version and Hugging Face revision hash used in the spike as the pins for D2; verify they appear in `.env.example` / `requirements.txt` in group 2. If p50 for 3 questions > ~3 s, stop and revisit design D2/D5 (ONNX) with the user before continuing

## 2. Scaffolding

- [x] 2.1 Create `server/` mirroring `kaizen/server` (`argos_api/`, `tests/`, `requirements.txt`, `requirements-dev.txt`, `pytest.ini`, `.dockerignore`, `.env.example`) and add `server/.env` to `.gitignore`; verify `git status` does not list `.env`
- [x] 2.2 Add settings via `pydantic-settings` (`ARGOS_API_KEYS`, `ARGOS_MODEL_REVISION`, `ARGOS_THREADS`, `ARGOS_MAX_QUEUE`, `HF_HOME`) with parsing of `id:key` pairs; verify unit tests cover parsing and the empty-keys startup failure

## 3. Decision engine adapter

- [x] 3.1 Define the `DecisionEngine` protocol and a fake implementation for tests; verify the fake is used by a passing test
- [x] 3.2 Implement the Laya engine (background load, `torch.set_num_threads`, `predict` with `min_confidence`) and the request/response translation (`text`→state, `yesno`↔`noul`, score `level`); verify unit tests of the translation functions with recorded Laya result fixtures pass
- [x] 3.3 Add the `@pytest.mark.model` smoke test that loads the real checkpoint and answers one choice, one score and one yesno question; verify it is skipped by default and passes with `pytest -m model`

## 4. HTTP API

- [x] 4.1 Implement Pydantic request models with the validation and size limits (422 vs 413) from `decision-api`; verify API tests cover each validation and limit scenario
- [x] 4.2 Implement bearer-key auth dependency for `/v1/*` with `hmac.compare_digest` and `WWW-Authenticate`; verify tests for missing, wrong and valid keys and multiple named keys
- [x] 4.3 Implement `POST /v1/decide` with the semaphore + bounded wait queue (`503` + `Retry-After`) and `latency_ms`/`model` metadata; verify tests for a successful multi-question call, `min_confidence` flags, and the saturated-queue scenario using a slow fake engine
- [x] 4.4 Implement `GET /health` with loading/ready states and `503` on decide while loading; verify tests for both states and that the body contains only `status`/`model`
- [x] 4.5 Add metadata-only request logging (status, latency, question count, key id); verify a test asserts the submitted text never appears in captured logs
- [x] 4.6 Document the API (request/response examples, question types, limits, Laya accuracy caveats) in `server/README.md`; verify the documented `curl` examples match the tested contract

## 5. Container and deployment

- [x] 5.1 Write the `Dockerfile` (`python:3.12-slim`, non-root `app`, uvicorn on `:8080`, `HF_HOME=/data/hf`); verify `docker build` succeeds on the Pi and `docker run` reaches `/health` = `200`
- [x] 5.2 Write `docker-compose.yml` (`argos-api`, `restart: unless-stopped`, `mem_limit: 3g`, `argos-hf-cache` volume, external `proxy` network, Traefik labels for `argos.northernarchive.com` on port 8080); verify `docker compose config` is valid
- [x] 5.3 User: add the `argos` DNS record in the cdmon web UI; verify `dig +short argos.northernarchive.com` returns the home public IP
- [x] 5.4 Deploy with `docker compose up -d --build`, create `.env` with generated keys (`openssl rand -hex 32`); verify `docker compose exec argos-api printenv ARGOS_API_KEYS` is intact and container RAM stays under the limit (`docker stats`)

## 6. End-to-end verification

- [x] 6.1 From outside the Pi: `https://argos.northernarchive.com/health` returns `200` with a valid certificate, an unauthenticated `POST /v1/decide` returns `401`, and an authenticated Spanish triage request returns `200` with sensible answers; record latency in `server/README.md`
- [x] 6.2 Update `CLAUDE.md` with the real commands (run tests, run a single test, run the model smoke test, build/deploy) and the server layout
