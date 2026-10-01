# api-access Specification

## Purpose

Restricts the decision API to known callers holding a pre-shared API key, so the host's
CPU is only spent on trusted requests.

## Requirements

### Requirement: Bearer API key required
Every `/v1/*` endpoint SHALL require an `Authorization: Bearer <key>` header whose key matches
one of the keys configured for the deployment, and SHALL respond `401` with a
`WWW-Authenticate: Bearer` header otherwise, without running inference.

#### Scenario: Missing header
- **WHEN** a decide request has no `Authorization` header
- **THEN** the response is `401` with `WWW-Authenticate: Bearer`

#### Scenario: Wrong key
- **WHEN** a decide request presents a key that is not configured
- **THEN** the response is `401`

#### Scenario: Valid key
- **WHEN** a decide request presents a configured key
- **THEN** the request is processed normally

### Requirement: Multiple named keys
The deployment SHALL support several keys at once, each with a short identifier (for example
one per client project), so that a single key can be revoked by removing it from
configuration and restarting, without affecting the others.

#### Scenario: Revoked key
- **WHEN** key `nurk` is removed from configuration and the service restarted
- **THEN** requests with that key receive `401` while requests with other keys still succeed

### Requirement: Refuse to start without keys
The service SHALL fail to start when no API key is configured, rather than serving
unauthenticated.

#### Scenario: No keys configured
- **WHEN** the container starts with an empty key configuration
- **THEN** the process exits with an error stating that no API keys are configured

### Requirement: HTTPS only from outside
The public endpoint SHALL be reachable only over HTTPS at `argos.northernarchive.com`.

#### Scenario: Public HTTPS
- **WHEN** a client calls `https://argos.northernarchive.com/health`
- **THEN** it receives a valid Let's Encrypt certificate and a `200`
