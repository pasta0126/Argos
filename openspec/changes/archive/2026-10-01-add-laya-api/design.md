# Design

## Context

- Target host is `void-server`: Raspberry Pi 4B, arm64, 4 cores, 7.7 GB RAM, no GPU, zram
  swap. It already runs ~15 containers (kaizen, nurk, mundus, atlas, platform Postgres +
  GoTrue, Traefik…). Ingress, TLS and DNS conventions live in the `pasta0126/infra` repo
  (see its `CLAUDE.md` and `ROADMAP.md`).
- Sibling APIs (`kaizen/server`, `nurk/server`) set the house style: FastAPI on
  `python:3.12-slim`, uvicorn on `:8080`, non-root `app` user, `env_file: .env`, external
  `proxy` network, Traefik labels with `entrypoints=websecure` + `tls.certresolver=le`.
- Laya (`pip install laya`, Apache-2.0, v0.3.x) runs on PyTorch. The `laya-multilingual`
  checkpoint is mmBERT-base, 322M params, ~644 MB `model.safetensors` + 34 MB tokenizer,
  1,024-token default context. Published CPU latency is 193–464 ms per request on a desktop
  CPU; on a Pi 4 it is unmeasured.
- Requirements are in `specs/decision-api`, `specs/api-access` and `specs/service-health`.

## Goals / Non-Goals

**Goals:**
- One self-contained container that serves the specs with the house conventions.
- Laya hidden behind an adapter so a Laya upgrade or a checkpoint change does not change the
  public contract.
- Predictable behaviour on a shared Pi: bounded memory, bounded CPU threads, no unbounded
  queues.

**Non-Goals:**
- GPU support, horizontal scaling, multi-replica deployment.
- Using Laya's own `laya-serve` / `/v1/systemone` wire protocol.
- Storing requests or answers.

## Decisions

### D1. Own FastAPI wrapper, not `laya-serve`
Argos is a FastAPI app that imports Laya in-process.
*Alternative:* run `laya[serve]` as-is (`POST /v1/systemone`, `LAYA_API_KEY`). Rejected:
contract owned by a third-party 0.x library, single shared key, no request limits or
privacy-aware logging, and no place to add Argos-specific features later (presets, quotas).
The wrapper is small, and matches the other APIs on the host.

### D2. Single checkpoint, loaded directly
Load `laya.load("convaiinnovations/laya", subfolder="multilingual")` once at startup and call
`agent.predict(state, questions, ...)`; do not use `Router`.
*Alternatives:* `Router` with `english` + `multilingual` (~1.5 GB of weights and two models
resident, better English accuracy), or all three checkpoints (~2.3 GB). Rejected for RAM on
a shared Pi and because most traffic is Spanish. The Hugging Face revision (commit hash) is
pinned in configuration so weights cannot change under a running deployment; the `laya`
package version is pinned exactly (`laya==0.3.22` or the version validated in task 1).

### D3. Argos contract with a thin adapter
Public names differ slightly from Laya's: `text` instead of `state`, `yesno` instead of
`noul` (criteria keys `yes`/`no` mapped to Laya's `true`/`false`), and `score` answers add a
`level` label. A single adapter module translates request → Laya and Laya result → response;
the HTTP layer depends on a `DecisionEngine` protocol (`load()`, `decide(text, questions,
min_confidence)`), not on Laya directly. `low_confidence` is computed by the adapter from
Laya's `answer_confidence` (max probability) — the same value Laya's own `min_confidence`
reads — so the flag is always an explicit boolean when a threshold is given.
*Alternative:* pass Laya's JSON through untouched. Rejected: `noul` is opaque to callers and
any Laya rename would break every client.

### D4. Static named API keys from `.env`
`ARGOS_API_KEYS="kaizen:<key>,nurk:<key>,cli:<key>"`. Keys are compared with
`hmac.compare_digest`; the matched id is attached to the request for logging. Generated with
`openssl rand -hex 32` (no `$`, per the infra Compose-interpolation gotcha). Startup fails if
the variable is empty (spec `api-access`).
*Alternatives:* GoTrue JWTs (adds a user model the use case does not need), a Traefik
basic-auth middleware (one credential, less flexible). Either can be added later.

### D5. One inference at a time, bounded wait
Inference runs in a worker thread (`run_in_threadpool`) guarded by an `asyncio.Semaphore(1)`;
a counter of waiters rejects with `503` + `Retry-After` once `ARGOS_MAX_QUEUE` (default 4)
requests are waiting. Torch intra-op threads capped with `torch.set_num_threads(ARGOS_THREADS)`
(default 3) so one core stays free for the other services. Limits from `decision-api`
(8,000 chars, 10 questions, 20 options) are enforced by Pydantic models before the queue.
*Alternative:* multiple uvicorn workers. Rejected: each worker would hold its own ~1.3 GB
copy of the model.

### D6. Background model load and cached weights
The FastAPI lifespan starts model loading in a background thread so the server answers
`/health` (`503 loading`) immediately; a ready flag flips when loading finishes. Weights are
cached in a named volume (`argos-hf-cache` mounted at `/data/hf`, `HF_HOME=/data/hf`) so
rebuilds and restarts do not re-download ~680 MB.
*Alternative:* bake weights into the image at build time. Rejected for now: +700 MB image
on every rebuild and slower builds on the Pi; revisit if offline starts become important.

### D7. Container and deploy layout
`server/` holds `argos_api/`, `tests/`, `Dockerfile`, `docker-compose.yml`, `.env.example`,
`requirements.txt` / `requirements-dev.txt`, `pytest.ini` — mirroring `kaizen/server`.
Image on `python:3.12-slim`. `torch` is installed first from the CPU-only index
(`--index-url https://download.pytorch.org/whl/cpu`), then `laya`, which finds torch already
satisfied. *Found during the spike:* on aarch64 the default PyPI `torch` wheel is no longer
CPU-only — it pulls ~3 GB of NVIDIA CUDA wheels (cuDNN, cuBLAS…) that are useless on the Pi.
Compose: service/container `argos-api`, `restart: unless-stopped`, `mem_limit: 3g`,
`proxy` network, Traefik router `argos-api` on ``Host(`argos.northernarchive.com`)``,
loadbalancer port `8080`. Built and run on the Pi itself.

### D8. Tests without the model
Unit and API tests use a fake `DecisionEngine` injected through FastAPI dependency
overrides, so `pytest` runs in seconds without torch weights. One real-model smoke test is
marked `@pytest.mark.model` and skipped by default (`pytest -m model` to run it, e.g. inside
the container).

### D9. Metadata-only logging
One structured log line per request: method, path, status, latency, question count, key id.
Request bodies are never logged; uvicorn's access log stays on (it contains no body).

## Risks / Trade-offs

- [Pi 4 CPU latency unknown; could be several seconds per call] → Task 1 measures real
  latency on the Pi before building the service. If p50 for 3 questions exceeds ~3 s,
  evaluate `laya[onnx]` (ONNX Runtime) before continuing.
- [RAM pressure on a shared host] → single checkpoint, `mem_limit: 3g`, one worker; zram
  already configured on the host. *Found at deploy:* the kernel boots with
  `cgroup_disable=memory`, so `mem_limit` is not enforced until memory cgroups are enabled
  on the host (infra change, needs sudo + reboot). Measured: ~2.1 GB resident, 2.6 GB peak.
- [Zero-shot accuracy limits documented by Laya: negation, boolean-word labels in choice
  keys] → document in `server/README.md` (use semantic keys, avoid `yes`/`no` choice labels,
  use `min_confidence` and validate on own data); no accuracy guarantees in the specs.
- [Laya is a fast-moving 0.x library] → exact version pin + adapter (D3); upgrades are
  deliberate changes with the smoke test re-run.
- [CPU-heavy requests from a leaked key] → per-key revocation (D4) and bounded queue (D5);
  per-key quotas deferred.
- [First start depends on Hugging Face availability] → weights cached in a volume after the
  first successful download.

## Migration Plan

1. Add the `argos` DNS record in the cdmon web UI (manual, no API) pointing like the other
   `*.northernarchive.com` records.
2. On the Pi: `cd ~/argos/server && cp .env.example .env`, fill `ARGOS_API_KEYS`.
3. `docker compose up -d --build`; watch logs until the model is loaded; `curl
   https://argos.northernarchive.com/health` → `200`.
4. Rollback: `docker compose down` (volume can be kept); remove the DNS record if abandoning.

## Open Questions

- Whether to add a batch endpoint or Laya's `english` checkpoint later — depends on real
  usage; neither changes this change's specs.
