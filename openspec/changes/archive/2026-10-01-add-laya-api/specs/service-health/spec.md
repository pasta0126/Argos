# Spec Delta

## Purpose

Tells operators and clients whether the Argos API process is up and whether its decision
model is loaded and ready to answer.

## ADDED Requirements

### Requirement: Health endpoint
The system SHALL expose `GET /health` without authentication, returning `200` with
`{"status": "ok", "model": "<checkpoint>"}` once the model is loaded.

#### Scenario: Ready service
- **WHEN** the model has finished loading and `GET /health` is called with no credentials
- **THEN** the response is `200` with `status` = `ok`

### Requirement: Not ready while loading
Until the model is loaded, `GET /health` SHALL return `503` with `{"status": "loading"}`
and `POST /v1/decide` SHALL return `503` with `Retry-After`.

#### Scenario: Cold start
- **WHEN** the container has just started and is still loading or downloading the model
- **THEN** `GET /health` returns `503` with `status` = `loading`

#### Scenario: Decide during cold start
- **WHEN** an authenticated decide request arrives before the model is loaded
- **THEN** the response is `503` with `Retry-After`

### Requirement: Health reveals no secrets
The health response SHALL NOT include configuration values, key identifiers, or host details
beyond the checkpoint name and status.

#### Scenario: Health payload content
- **WHEN** `GET /health` is called
- **THEN** the body contains only `status` and, when ready, `model`
