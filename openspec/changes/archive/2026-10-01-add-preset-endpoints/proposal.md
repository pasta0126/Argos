# Proposal

## Why

In Swagger (`/docs`) presets appear only as `POST /v1/presets/{name}`: callers do not see
that `triage` and `guard` exist, what each one answers, or which question names they can
request, and have to type the preset name into a path parameter. The API owner asked for
one visible endpoint per preset so using a preset is as direct as calling `/v1/decide`.

## What Changes

- One documented operation per published preset: `POST /v1/presets/triage` and
  `POST /v1/presets/guard` appear in Swagger/OpenAPI with the preset's description, its
  questions, a request example, and the `questions` subset field restricted to that preset's
  question names (a dropdown in Swagger).
- Same URLs, bodies, responses and errors as today: existing callers of
  `/v1/presets/triage` and `/v1/presets/guard` see no difference.
- The generic `POST /v1/presets/{name}` keeps working (and keeps answering `404` for unknown
  names) but is no longer listed in the OpenAPI docs.
- `API.md`, `TESTING.md` and the README describe the per-preset endpoints.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `decision-presets`: adds a requirement that each published preset is a documented
  operation of its own, and that the generic route is not listed in the API docs.

## Impact

- **Code**: route registration in `server/argos_api/main.py` (one route per preset,
  generated from `PRESETS`) and a per-preset request model in `schemas.py`.
- **API docs**: `/openapi.json` and `/docs` change (new operations, generic one hidden).
- **Clients**: none break; URLs and payloads are unchanged.
- **Release**: backwards-compatible API addition, tag `v0.3.0`.
