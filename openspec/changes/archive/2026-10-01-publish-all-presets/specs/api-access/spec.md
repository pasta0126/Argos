# Spec Delta

## ADDED Requirements

### Requirement: Bearer scheme in the API description
The OpenAPI description SHALL declare an HTTP bearer security scheme and SHALL attach it to
every `/v1/*` operation, so interactive docs can send the API key; `/health` SHALL NOT require
it. Declaring the scheme SHALL NOT change how requests are authenticated.

#### Scenario: Scheme declared
- **WHEN** a client reads `/openapi.json`
- **THEN** `components.securitySchemes` contains a scheme of type `http` with scheme `bearer`

#### Scenario: Protected operations reference it
- **WHEN** a client reads the operations for `POST /v1/decide`, `GET /v1/presets` and every `POST /v1/presets/<preset>`
- **THEN** each lists that scheme in its `security`

#### Scenario: Health stays public
- **WHEN** a client reads the operation for `GET /health`
- **THEN** it has no `security` requirement

#### Scenario: Behaviour unchanged
- **WHEN** a decide request has no `Authorization` header
- **THEN** the response is still `401` with `WWW-Authenticate: Bearer`
