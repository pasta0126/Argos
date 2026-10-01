# Proposal

## Why

Today the only ways to try Argos are curl, Postman or Swagger, all of which require writing
the `questions` JSON by hand and reading raw probabilities. The owner wants a web page where
anyone with a key can build a decision step by step, see exactly what is sent and received,
and understand the answer at a glance with probability bars, always knowing what the page
is doing (model loading, sending, queued, retrying, failed).

## What Changes

- **BREAKING**: the API moves to `https://argos-api.northernarchive.com` (same paths,
  contract and presets). On the old host, `/v1/*`, `/health`, `/docs`, `/redoc` and
  `/openapi.json` answer `308` to the same path on the new host.
- The API allows cross-origin browser calls from the wizard's origin (CORS, configurable
  allow-list, `Retry-After` exposed).
- New web front (wizard) served at `https://argos.northernarchive.com/`, which it takes
  over entirely. Steps: key → mode (custom by default, or a preset) → text → questions →
  options → review & send → result.
- The custom mode builds a `/v1/decide` body from typed forms (choice / score / yes-no
  editors, with the API's limits enforced before sending); the preset mode calls
  `POST /v1/presets/<name>` with an optional question subset; a preset can be copied into
  the custom editor.
- A live payload JSON preview while building; after sending, the payload JSON, the response
  JSON (both copyable), a ready-to-paste curl with the key masked, and a visual rendering of
  each answer (bars per option/level, yes/no split bar, confidence, low-confidence flag,
  latency and model).
- Continuous status feedback: service health badge (polls `/health` while the model loads),
  key check, elapsed-time counter with an expected-duration hint while a decision runs,
  automatic retry with countdown on `503` (`loading` / `busy`), cancel, and a human-readable
  message for every API error (401, 413, 422 with the offending field, network).
- Two Traefik routers, one per host: `argos-api` on `argos-api.northernarchive.com`
  (DNS record already created) and a new `argos-web` container on
  `argos.northernarchive.com`.

## Capabilities

### New Capabilities
- `web-wizard`: browser UI that builds, sends and explains decision requests against the
  Argos API (wizard steps, client-side validation, payload/response JSON, answer
  visualization, status feedback, key handling).

### Modified Capabilities
- `api-access`: the public HTTPS host becomes `argos-api.northernarchive.com`; adds browser
  (CORS) access from the wizard origin and the redirect from the former host. The
  decision, preset and health contracts are unchanged.

## Impact

- **New code**: `web/` at the repo root (Vite + React static build served by nginx, own
  `Dockerfile` and `docker-compose.yml`), mirroring `~/kaizen/web`.
- **Server**: CORS middleware and an `ARGOS_CORS_ORIGINS` setting in `server/argos_api/`;
  Traefik rule in `server/docker-compose.yml` moves to the new host (container recreated,
  normal ~65 s model reload).
- **Infra**: new Let's Encrypt certificate for `argos-api.northernarchive.com` (issued
  automatically by Traefik); DNS already in place.
- **Docs**: every URL in `server/README.md`, `API.md`, `TESTING.md`, the Postman
  collection, root `CLAUDE.md` and `openspec/config.yaml` moves to the new host; README no
  longer says "there is no UI"; new `web/README.md`.
- **Clients**: any caller of `argos.northernarchive.com` must switch to the new host. A
  `308` covers browsers and Swagger links; `curl -L` drops `Authorization` across hosts,
  so scripts must update the URL. Release `v0.5.0`.
