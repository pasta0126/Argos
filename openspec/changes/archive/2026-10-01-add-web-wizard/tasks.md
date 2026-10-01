# Tasks

## 0. Move the API (server)

- [x] 0.1 Add `ARGOS_CORS_ORIGINS` to `Settings` (default `https://argos.northernarchive.com`, empty disables) and `CORSMiddleware` as the outermost layer per design D1b, logging the origins at startup; verify pytest: preflight from the allowed origin without key is allowed, CORS headers on 200/401/413 (body guard)/422/503 with `Retry-After` exposed, none for an unlisted origin, 401 still returned cross-origin without key, and the existing suite passes
- [x] 0.2 Change the Traefik rule in `server/docker-compose.yml` to ``Host(`argos-api.northernarchive.com`)`` and add `ARGOS_CORS_ORIGINS` to `.env.example`/README config table; verify `docker compose config` shows the new rule
- [x] 0.3 Move every base URL to `https://argos-api.northernarchive.com` in `server/README.md`, `API.md`, `TESTING.md`, the Postman collection, root `CLAUDE.md` and `openspec/config.yaml`, noting the move and the `curl -L` caveat; verify `grep -rn "argos.northernarchive.com"` outside `openspec/changes/archive` only hits the wizard/redirect mentions

## 1. Scaffold

- [x] 1.1 Create `web/` with Vite + React 19 + oxlint + Vitest (versions as in `~/kaizen/web`), `VITE_API_URL` (empty in dev) with Vite dev proxy for `/v1` and `/health` to `https://argos-api.northernarchive.com`; verify `npm run build`, `npm run lint` and `npm test` succeed on an empty app
- [x] 1.2 Add `web/Dockerfile` (node build stage → `nginx:alpine`, build context repo root), `ARG VITE_API_URL` defaulting to the production API), `web/nginx.conf` (cache headers, gzip, `try_files` fallback, CSP `default-src 'self'; connect-src 'self' https://argos-api.northernarchive.com`, `Referrer-Policy`, `nosniff`, and the 308 redirects of design D1c) and `web/docker-compose.yml` (`argos-web`, `proxy` network, router ``Host(`argos.northernarchive.com`)``); verify `docker compose build` succeeds and, with the image run locally, `curl -si localhost:<port>/v1/presets/triage?x=1` returns `308` with `Location: https://argos-api.northernarchive.com/v1/presets/triage?x=1`

## 2. Request model (pure logic, tested)

- [x] 2.1 Implement the draft reducer and `buildRequest(draft)` for preset (all / subset) and custom modes; verify unit tests cover subset → `questions` list, all selected → no `questions`, yes/no without descriptions → no `criteria`, threshold off → no `min_confidence`
- [x] 2.2 Implement `validate(draft)` mirroring `server/argos_api/schemas.py` limits and rules (constants with a pointer comment); verify one unit test per rule in the spec's "Client-side validation" requirement
- [x] 2.3 Implement `draftFromBody(body)` and bundle `server/examples/*.json` via `import.meta.glob`; verify round-trip `buildRequest(draftFromBody(x)).body` equals `x` for every non-preset example and for a fixture copy of `GET /v1/presets` output
- [x] 2.4 Implement the API client (bearer header, AbortController, `503` retry loop honouring `Retry-After` with max 6 attempts, error → Spanish message mapping incl. 422 `loc` → question name) and `curlFor(request)` with `$ARGOS_KEY`; verify unit tests with a mocked `fetch` for 200, 401, 404, 413, 422, 503-then-200, 503 exhausted, network error and abort, and that no output contains the key

## 3. Wizard UI

- [x] 3.1 Layout: header with health badge (polling per design D6), stepper, Back/Next, live payload side panel / mobile sheet with copy; verify in the dev server that the badge shows loading → ready against a restarted API and that Back keeps data
- [x] 3.2 Key step (session vs remembered storage, check via `GET /v1/presets`, forget key); verify manually with a valid and an invalid key and that closing the tab forgets a non-remembered key
- [x] 3.3 Mode step (preset cards from the API, custom, examples) and Text step (counter, 8,000 limit); verify loading the "ticket completo" example fills the editor as the spec scenario says
- [x] 3.4 Questions step: preset subset checklist with "Personalizar" and the custom editor (add/edit/reorder/remove, per-type criteria editors, type explanations, inline errors, 10-question cap); verify building the spec's `department` choice question shows the expected JSON in the preview
- [x] 3.5 Options step (threshold toggle + slider with explanation) and Review step (summary, errors list, send disabled while invalid); verify a one-option choice disables send and points to the question

## 4. Running and results

- [x] 4.1 Progress card (elapsed timer, estimate, 90 % cap bar, cancel) and retry countdown / manual retry; verify against the deployed API by sending two full presets at once from two tabs (one gets busy → retries) and by cancelling a request
- [x] 4.2 Result view with tabs Visual / Payload / Respuesta / curl, copy actions, "Editar petición" and "Nueva"; verify the Payload tab equals the body sent (network tab) and the curl runs as pasted with a real key
- [x] 4.3 `answerView` mapping and answer cards for choice, score (ordered levels + score marker) and yes/no (split bar), confidence meter, low-confidence chip, threshold line, model/latency/wall-time footer, light and dark; verify unit tests for the spec's choice-bars and score-marker scenarios and a visual check of all five presets at phone and desktop widths
- [x] 4.4 Error panel per status with raw JSON and actions (change key on 401, jump to question on 422); verify by provoking 401 (bad key), 413 (8,001 chars bypassing the client check in a test) and 422 via unit tests and one live 401

## 5. Docs and release

- [x] 5.1 Write `web/README.md` (dev, test, deploy, `VITE_API_URL`, the two hosts and the redirects) and update root `CLAUDE.md`, `server/README.md` (UI now exists), `server/API.md`/`TESTING.md` (link the wizard) and `openspec/config.yaml` context; verify the documented dev/deploy commands run as written
- [x] 5.2 Deploy following design's Migration Plan (build web image → `up -d --build` in `server/` → `up -d` in `web/`); verify `https://argos-api.northernarchive.com/health` is 200 with a valid certificate, a preset call works on the new host, the Postman collection passes with newman against the new base URL, `https://argos.northernarchive.com/docs` lands on the new host, and a full wizard run (preset and custom) works from the browser
- [x] 5.3 Commit, tag `v0.5.0` (release notes flag the **BREAKING** host move) and push; verify the tag is on origin
