# Tasks

## 1. Per-preset endpoints

- [x] 1.1 Build a per-preset request model (`questions: list[Literal[...]]`, min 1, extra forbidden) and register `POST /v1/presets/<name>` for every preset before the generic route, with summary, description listing the questions, request example and `PresetResponse`; verify tests: `/openapi.json` has both operations and the enum of guard question names, and `/v1/presets/guard` returns 200 with `preset` = `guard`
- [x] 1.2 Hide the generic `POST /v1/presets/{name}` from the schema (`include_in_schema=False`) keeping its behaviour; verify tests: `/openapi.json` has no `/v1/presets/{name}` path, `/v1/presets/horoscope` is still 404, and the existing preset test suite passes unchanged except where the 422 body shape is asserted
- [x] 1.3 Verify an unknown subset name on a per-preset URL is 422 with the name in the body, and that logs still carry `preset=<name>` without the text (tests)

## 2. Documentation

- [x] 2.1 Update `server/API.md` (endpoint list and the presets section: one endpoint per preset, the generic route as an alternative, new 422 body for an unknown question with a real example), `server/TESTING.md` and `server/README.md`; verify every documented curl/JSON matches a real call against the deployed service

## 3. Release

- [x] 3.1 Deploy on void-server, check `/docs` lists `POST /v1/presets/triage` and `POST /v1/presets/guard` with the question dropdown, and run the Postman collection with newman (all assertions pass)
- [x] 3.2 Commit, tag `v0.3.0` and push; verify the tag is on origin
