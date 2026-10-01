# Proposal

## Why

Several personal projects (kaizen, nurk, scripts, future automations) need quick, structured
decisions over free text — classify, score, yes/no — without calling a paid LLM and parsing
generated prose. [Laya](https://laya.convaiinnovations.com/) is an Apache-2.0, CPU-capable
"System 1" decision engine that returns calibrated probabilities in a single forward pass.
Argos makes it available as a self-hosted HTTP service on `void-server`, so any project can
ask for a decision with one authenticated request.

## What Changes

- New **Argos API**: a small FastAPI service (this repo, `server/`) that loads Laya's
  `laya-multilingual` checkpoint in-process and exposes it over HTTP with Argos' own contract.
- Endpoints:
  - `POST /v1/decide` — one text + a set of typed questions (`choice`, `score`, `yesno`)
    → one answer per question with probabilities.
  - `GET /health` — liveness/readiness, unauthenticated.
- Access by **static API keys** (`Authorization: Bearer <key>`), configured in a git-ignored
  `.env`; no user accounts.
- Request limits sized for a Raspberry Pi 4 (text length, number of questions/options,
  one inference at a time with a bounded wait queue).
- Packaged as a Docker image, deployed with its own `docker-compose.yml`, published at
  **`argos.northernarchive.com`** through the existing Traefik ingress (`proxy` network,
  Let's Encrypt). Model weights cached in a Docker volume.

Out of scope (later changes): batch endpoint, other Laya checkpoints (`english`,
`typed-decisions`), fine-tuning, saved question presets, per-key quotas/usage tracking,
GoTrue/JWT auth, a web UI, persistence of requests.

## Capabilities

### New Capabilities
- `decision-api`: the decision request/response contract — question types, answer shape,
  input validation and limits, and behaviour under load.
- `api-access`: how callers authenticate with API keys and what unauthenticated or
  invalid requests receive.
- `service-health`: the health endpoint and the readiness semantics while the model loads.

### Modified Capabilities
<!-- none: no existing specs in this repo -->

## Impact

- **New code**: `server/` (FastAPI app, Dockerfile, compose, tests) in this repo.
- **Dependencies**: `laya` (pulls `torch` CPU, `transformers`, `huggingface_hub`), FastAPI,
  uvicorn. First start downloads ~650 MB of weights from Hugging Face.
- **Host (`void-server`)**: new container on the `proxy` network; ~1.5–2 GB RAM resident
  and bursts of CPU on all cores during inference, shared with ~15 existing containers.
- **DNS**: an `argos` A/CNAME record must be added by hand in the cdmon web UI.
- **Clients**: other projects call `https://argos.northernarchive.com/v1/decide` with a key.
