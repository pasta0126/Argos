# Design

## Context

`server/argos_api/main.py` registers `GET /v1/presets` and one generic
`POST /v1/presets/{name}` handler that looks the name up in `PRESETS`, validates the
`questions` subset by hand (custom `422`) and calls the shared `run_decision`. Swagger shows
that single operation with a free-text `name`. Requirements: `specs/decision-presets/spec.md`
(this change adds two) and the archived `decision-presets` spec.

## Goals / Non-Goals

**Goals:**
- Each preset discoverable in Swagger with its questions, without changing any URL or payload.
- Adding a preset to `PRESETS` adds its endpoint automatically; no per-preset code.

**Non-Goals:**
- Changing preset contents, the answer format or `GET /v1/presets`.
- Removing the generic route (clients may build the URL from a variable).

## Decisions

### D1. Generate one route per preset in `create_app`
Loop over `PRESETS` and register `POST /v1/presets/<name>` with a handler bound to that preset,
`summary`/`description` built from the preset (description + list of questions with their type
and options), an OpenAPI request example (`text` + `min_confidence`), and the response model
`PresetResponse`. The handler delegates to the same internal function the generic route uses,
so behaviour cannot drift.
*Alternative:* hand-written handlers per preset. Rejected: duplicates code and forgets new
presets.

### D2. Per-preset request model with an enum for `questions`
Build the request model per preset with `pydantic.create_model`, typing `questions` as
`list[Literal[<that preset's names>]]` (min length 1). Swagger renders the allowed names; an
unknown name becomes a standard Pydantic `422` whose `loc` points at the item and whose `input`
is the bad name. The generic route keeps `PresetRequest` and its hand-written check.
*Alternative:* keep one shared model and document the names in the description only. Rejected:
no dropdown, which is the point of the change.

### D3. Route order and hiding the generic route
FastAPI matches routes in registration order, so the per-preset routes are registered before the
generic one. The generic route gets `include_in_schema=False`; it still answers (including
`404`), but Swagger shows only real presets.

### D4. Logging unchanged
Per-preset handlers set `request.state.preset` like the generic one, so log lines keep
`preset=<name>` and stay content-free.

## Risks / Trade-offs

- [`422` body for an unknown subset name changes shape on per-preset URLs (Pydantic's
  `literal_error` instead of our custom `value_error`)] → Both are `422` with a `loc` pointing at
  the item and the name present in the body, which is what the spec requires; documented in
  `API.md`. Nobody parses this message today.
- [OpenAPI grows with each preset] → Two presets today; negligible.

## Migration Plan

Additive. Deploy with `docker compose up -d --build`, check `/openapi.json` and run the Postman
collection; tag `v0.3.0`. Rollback: redeploy `v0.2.1`.
