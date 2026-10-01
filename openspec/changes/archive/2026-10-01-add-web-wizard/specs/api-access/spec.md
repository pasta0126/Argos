# Spec Delta

## MODIFIED Requirements

### Requirement: HTTPS only from outside
The public endpoint SHALL be reachable only over HTTPS at `argos-api.northernarchive.com`.

#### Scenario: Public HTTPS
- **WHEN** a client calls `https://argos-api.northernarchive.com/health`
- **THEN** it receives a valid Let's Encrypt certificate and a `200`

## ADDED Requirements

### Requirement: Browser access from the wizard origin
The API SHALL allow cross-origin `GET` and `POST` calls carrying `Authorization` and
`Content-Type` from a configured list of origins (by default only
`https://argos.northernarchive.com`), without cookies, and SHALL expose `Retry-After` to
those origins. Other origins SHALL receive no CORS allow headers. Authentication is unchanged.

#### Scenario: Preflight from the wizard
- **WHEN** a browser sends `OPTIONS /v1/decide` with `Origin: https://argos.northernarchive.com`, `Access-Control-Request-Method: POST` and `Access-Control-Request-Headers: authorization, content-type`
- **THEN** the response allows that origin, method and headers, without requiring an API key

#### Scenario: Error responses readable by the wizard
- **WHEN** the wizard's origin gets a `401`, `413`, `422` or `503` response
- **THEN** the response carries `Access-Control-Allow-Origin` for that origin, and a `503` also lists `Retry-After` in `Access-Control-Expose-Headers`

#### Scenario: Unlisted origin
- **WHEN** a request comes with `Origin: https://evil.example`
- **THEN** the response has no `Access-Control-Allow-Origin` header

#### Scenario: Key still required cross-origin
- **WHEN** the wizard's origin calls `POST /v1/presets/triage` without `Authorization`
- **THEN** the response is `401`

### Requirement: Former host redirects
On `argos.northernarchive.com`, requests to `/v1/*`, `/health`, `/docs`, `/redoc` and
`/openapi.json` SHALL be answered with `308` to the same path and query on
`https://argos-api.northernarchive.com`, without reaching the API.

#### Scenario: Old preset URL
- **WHEN** a client posts to `https://argos.northernarchive.com/v1/presets/triage`
- **THEN** the response is `308` with `Location: https://argos-api.northernarchive.com/v1/presets/triage`

#### Scenario: Old docs link
- **WHEN** a browser opens `https://argos.northernarchive.com/docs`
- **THEN** it ends on `https://argos-api.northernarchive.com/docs`
