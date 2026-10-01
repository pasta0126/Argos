# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Argos is a self-hosted HTTP API that exposes the [Laya](https://laya.convaiinnovations.com/)
decision engine (`pip install laya`: typed choice / score / yes-no decisions over text with
calibrated probabilities) at `argos.northernarchive.com`. The decisions behind it (FastAPI
wrapper instead of `laya-serve`, `laya-multilingual` checkpoint only, bearer API keys) are in
the archived changes' `design.md` under `openspec/changes/archive/`; current requirements in
`openspec/specs/`. Limits, performance numbers and Laya accuracy caveats: `server/README.md`.
Client-facing API reference with real request/response examples (Spanish): `server/API.md` —
regenerate its example responses against the live service when the contract or presets change.

## Commands (run in `server/`)

```bash
.venv/bin/python -m pytest                                   # fast tests, fake engine, no torch
.venv/bin/python -m pytest tests/test_decide.py::test_over_limit_is_413   # single test
docker compose up -d --build && docker compose logs -f argos-api          # deploy; model loads ~65 s
```

The real-model smoke test (`pytest -m model`, deselected by default) runs inside the image —
see `server/README.md` for the exact command (run tests as `app`, not root, or the shared
weights volume gets root-owned files). Install `torch` from the CPU index
(`https://download.pytorch.org/whl/cpu`) everywhere: on aarch64 the PyPI wheel pulls ~3 GB of CUDA.

## Architecture (`server/argos_api/`)

- `main.py` — `create_app(settings, engine)` factory (uvicorn `--factory`). Model loads in a
  background thread at startup; `/health` and `/v1/decide` return 503 until ready. A failed
  load hard-exits so Docker restarts the container.
- `engine.py` — `DecisionEngine` protocol; the HTTP layer only depends on this. Tests inject
  `FakeEngine` (`tests/conftest.py`).
- `laya_engine.py` — the only module importing laya/torch, plus pure translation functions
  between the Argos contract and Laya's (`yesno` ↔ Laya `noul`, `text` ↔ state, score `level`).
- `gate.py` — one inference at a time, bounded wait queue (`ARGOS_MAX_QUEUE`) → 503 `busy`.
- `schemas.py` — request models (422 on malformed) and `limit_violation` (413 on size limits;
  kept out of Pydantic on purpose so limits are 413, not 422).
- `presets.py` — Spanish question sets. `main.py` registers one documented
  `POST /v1/presets/<name>` per preset (request model from `preset_request_model`, enum of
  question names) before the hidden generic `/v1/presets/{name}`; all share `run_decision`.
  A preset question is published only if it reaches 80 % balanced accuracy in `evals/run_presets.py` over `evals/presets.jsonl` (real model, inside
  the image; command in `server/README.md`). Rerun it after touching presets, `laya` or the
  model revision.
- `auth.py` — `ARGOS_API_KEYS="id:key,..."`; the id is logged, request text never is.

## Deployment target

Runs on `void-server` (Raspberry Pi 4B, arm64, no GPU, shared with ~15 containers) — the host
this checkout lives on. Shared ingress (Traefik v3.7, external `proxy` network, Let's Encrypt),
DNS (manual records in cdmon) and the shared Postgres/GoTrue platform are defined in
`~/infra` (`pasta0126/infra`); read its `CLAUDE.md`/`ROADMAP.md` before touching ingress.
Sibling APIs `~/kaizen/server` and `~/nurk/server` are the reference for layout, Dockerfile
and compose conventions.

## Workflow: OpenSpec (spec-driven)

Design decisions go through OpenSpec change proposals (`openspec/config.yaml`, schema
`spec-driven`), not ad-hoc edits. The CLI is not installed globally — run it with
`npx -y @fission-ai/openspec@latest <cmd>` (e.g. `list`, `show <item>`, `validate <change> --strict`, `status --change <change>`).

- `/opsx:propose "<idea>"` — create a change (proposal, specs, design, tasks). Planning only.
- `/opsx:explore` — investigate before proposing.
- `/opsx:update` — revise an existing change's artifacts.
- `/opsx:apply <change>` — implement an approved change's tasks.
- `/opsx:archive <change>` — fold a completed change into `openspec/specs/`.

Do not start implementation in the same turn as a proposal; wait for an explicit request to
apply. Keep `openspec/config.yaml` `context` current as the stack evolves.
