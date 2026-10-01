# Design

## Context

- Argos is API-only today (`server/`, FastAPI behind Traefik at `argos.northernarchive.com`,
  router `argos-api` with rule `Host(...)` only). The owner created
  `argos-api.northernarchive.com` (same IP) and wants the API there and the front on the
  current host. No CORS middleware exists today.
- Clients of the old host: only this repo's docs, Postman collection and testers.
- Every `/v1/*` call needs `Authorization: Bearer <key>`; `GET /v1/presets` is cheap, works
  while the model loads, and is the natural key check. `/health` is public.
- Inference is serialized (one at a time, queue of `ARGOS_MAX_QUEUE`, then `503 busy` with
  `Retry-After: 5`); a cold start answers `503 loading` for ~65 s. Warm latency: ~1.1 s for
  1 question, ~2.3 s for 3, 7–11 s for a full preset (`server/README.md`).
- Siblings: `~/kaizen/web` (Vite + React, multi-stage Dockerfile → `nginx:alpine`, own
  compose and Traefik router on its own subdomain) and `~/nurk/web` (plain static nginx).
- `server/examples/*.json` already holds valid `/v1/decide` bodies used by Postman/tests.

## Goals / Non-Goals

**Goals:**
- API changes limited to the host and CORS; decision, preset and health contracts
  untouched. The front deploys, rolls back and stops without touching `argos-api`.
- The front is pure static files; all logic in the browser.
- Request building, validation and answer→view mapping are pure functions with unit tests.

**Non-Goals:**
- Accounts, login or issuing API keys from the UI (keys stay in `.env`).
- History of past requests, sharing links, batch of texts.
- Streaming / queue position (the API does not expose them).
- English UI or theming beyond light/dark following the OS.

## Decisions

### D1. Two domains: API on `argos-api.`, front on `argos.`
- `argos-api` router: ``Host(`argos-api.northernarchive.com`)`` (rule change only).
- `argos-web` router: ``Host(`argos.northernarchive.com`)``, nginx serving the build.
- The wizard calls the absolute API URL baked at build time (`VITE_API_URL`, default
  `https://argos-api.northernarchive.com`), like kaizen's `VITE_API_URL`.

Owner's decision, which also matches the kaizen layout (`kaizen.` + `kaizen-api.`) and
lets each piece evolve independently. *Alternative considered first: same host with a
path-claiming router* — no CORS, no move, but the API would share its host with a UI and
every new static path would need a routing rule; dropped at the owner's request.

### D1b. CORS in the API
Starlette `CORSMiddleware` with `allow_origins` from a new setting `ARGOS_CORS_ORIGINS`
(comma-separated, default `https://argos.northernarchive.com`; empty disables CORS),
`allow_methods=["GET","POST"]`, `allow_headers=["Authorization","Content-Type"]`,
`expose_headers=["Retry-After"]`, `allow_credentials=False` (bearer header, no cookies),
`max_age=600`. It is added *after* the `guard_and_log` HTTP middleware so it is the
outermost layer: the 413 from the body guard, 401s, 422s and 503s all carry CORS headers,
otherwise the browser would hide them from the wizard as opaque network errors.
Preflights are answered by the middleware before routing, so they need no key and never
reach the inference gate. *Alternative: proxy the API through the web's nginx* → keeps
same origin but makes the front a hop for every client-side call and hides real client
latency; rejected. *Alternative: `allow_origins=["*"]`* → harmless for auth (keys are
bearer, not cookies) but invites third-party pages to burn the Pi's CPU with users' keys;
rejected.

### D1c. Redirect from the former host
The web nginx answers `return 308 https://argos-api.northernarchive.com$request_uri;` for
`/v1/`, `/health`, `/docs`, `/redoc` and `/openapi.json` (exact/prefix locations). `308`
keeps method and body. Browsers and Swagger links follow it; `curl -L` drops
`Authorization` across hosts (→ `401`), so scripts must change the URL — stated in the
release notes and docs. The redirect lives in the front so the API container answers only
its own host.

### D2. Vite + React, no chart library
Same toolchain as `kaizen/web` (React 19, Vite, oxlint), plus Vitest for pure-logic tests.
Bars are plain HTML/CSS (`width: N%`, CSS transitions) — the visuals are horizontal bars,
a split bar and a marker on a scale, which do not justify Recharts' weight on a Pi-served
page. *Alternative: plain HTML/JS like nurk* → the question editor (nested dynamic forms,
live JSON) is markedly simpler with React state.

### D3. State model: one request draft, derived payload
A single reducer holds the draft: `mode` (`preset` | `custom`), `presetName`,
`presetSubset`, `text`, ordered list of custom questions (each with a stable local id,
`name`, `type`, `instructions`, typed criteria rows), `minConfidence` (null = off).
Pure functions derive from it:
- `buildRequest(draft) → { method, path, body }` — the single source for the preview, the
  send, the curl and the "payload" panel, so what is shown is exactly what is sent.
- `validate(draft) → [{ field, message }]` — mirrors `schemas.py` (`MAX_TEXT_CHARS`
  8000, `MAX_QUESTIONS` 10, `MAX_OPTIONS` 20, choice/score ≥ 2 options, unique non-empty
  names, yes/no descriptions both or none). Limits are duplicated as constants in the front
  with a comment pointing to `schemas.py`; the API still validates, and its 413/422 are
  shown if the two ever drift.
- Converting a preset (from `GET /v1/presets`) or an example JSON into custom questions is
  the inverse function `draftFromBody(body)`; round-trip `buildRequest(draftFromBody(x))`
  equals `x` is a unit test over every file in `server/examples/` and every listed preset.

Questions are an ordered list in the draft (stable editing/reordering), serialized to the
`questions` object in that order.

### D4. Wizard layout
Steps: 1 Clave · 2 Modo · 3 Texto · 4 Preguntas · 5 Opciones · 6 Revisar y enviar, then a
Result view. A stepper on top (current / done / with errors), Back/Next at the bottom,
and a collapsible side panel (bottom sheet on mobile) with the live endpoint + payload JSON
from step 2 onward. Steps already completed are clickable. The Result view has tabs:
**Visual** (default) · **Payload** · **Respuesta** · **curl**, with "Copiar" on each JSON
tab and actions "Editar petición" (back to step 6 with the draft intact) and "Nueva".

### D5. Answer visualization
Mapping per type (pure function `answerView(question, answer)`, tested):
- **choice**: options sorted by probability desc, bar width = probability, winner in the
  accent color with a check, others neutral; percent label right-aligned (integer; one
  decimal below 1 %; `<0,1 %` for tiny values; Spanish number format).
- **score**: levels in original order (lowest first, not sorted) so the scale reads
  naturally; selected `level` highlighted; below, a 0…n-1 track with a marker at `score`
  and the level labels as ticks.
- **yesno**: one split bar, "Sí" share = `probability`, "No" = 1 − p, with a big
  Sí/No badge from `answer`.
- Every card: question name + instructions, confidence as a small meter, and a ⚠ "confianza
  baja" chip when `low_confidence` is true; when a threshold was sent, a dashed line at that
  value on choice/score bars.
- Footer: `model`, `latency_ms` and the wall-clock time measured by the browser (it
  includes queue wait, so the two can differ — labelled accordingly).
Colors follow a small token set (light/dark via `prefers-color-scheme`); the winner color
is never the only signal (check icon + bold label) for accessibility.

### D6. Status and progress feedback
- **Health badge** (always visible in the header): `GET /health` on load; `503 loading` →
  "Cargando modelo…" and re-check every 5 s; `200` → "Listo · <model>" and re-check every
  60 s; network error → "Sin conexión" and re-check every 10 s.
- **Key step**: "Comprobando clave…" spinner during `GET /v1/presets`.
- **Sending**: send button disabled and replaced by a progress card: "Enviando…",
  elapsed seconds ticking, expected ≈ Σ(0.4 + 0.15 × options²) s over the answered
  questions (yes/no = 2 options; fitted to measured 3.4 s for a (3, 3, 2) request and 11.9 s
  for the triage preset — options weigh far more than the question count), labelled
  "aprox.", a bar that fills to 90 % over the estimate then waits, and "Cancelar"
  (AbortController). Cancelling only stops the browser side: the server still finishes that
  inference.
- **503**: reason-specific text ("El modelo se está cargando" / "El servidor está
  ocupado con otra petición"), countdown from `Retry-After` (fallback 5 s), up to 6
  automatic attempts (~30 s, enough for a busy queue; a full cold load may exhaust it, in
  which case the health badge already tells the story) then a "Reintentar" button.
- **Errors**: mapped messages per status (401 offers "Cambiar clave"; 413 shows the API's
  `detail`; 422 maps `loc` like `["body","questions","refund","criteria"]` to "pregunta
  `refund` → criteria" and focuses that question in the editor; 404 preset; network).
  The raw error JSON is always available under "Ver respuesta".

### D7. Key storage
`sessionStorage` by default; a "Recordar en este navegador" checkbox moves it to
`localStorage`. "Olvidar clave" clears both. The key is only read when building the
`Authorization` header; payload/curl views use `$ARGOS_KEY`. nginx sends a strict CSP
(`default-src 'self'; connect-src 'self' https://argos-api.northernarchive.com`, no
third-party scripts or fonts), `Referrer-Policy: no-referrer` and
`X-Content-Type-Options: nosniff`, limiting what an injected script could exfiltrate.

### D8. API URL as build arg
`VITE_API_URL` is a Dockerfile `ARG` (default the production API); the image builds from
`web/` alone. In dev it is empty and Vite's proxy forwards `/v1` and `/health` to the
production API, so local dev needs no CORS entry for `localhost`. The bundled examples of
the first version were dropped from the UI at the owner's request (custom is the default
mode); `server/examples/` is still used by a round-trip unit test of the editor.

### D9. nginx
`index.html` with `Cache-Control: no-cache`; `/assets/*` (hashed names) with
`Cache-Control: public, max-age=31536000, immutable`; gzip on; the D1c redirects; any other
path falls back to `index.html` (`try_files`).

## Risks / Trade-offs

- [**BREAKING** host move: an unknown script still calling `argos.northernarchive.com`
  gets `308`, and `401` if it follows it] → the redirect makes the move visible instead of
  a silent 404; docs, Postman and release notes point to the new host.
- [CORS misconfigured → the wizard sees every failure as a network error] → tests assert
  CORS headers on 200/401/413/422/503 and on preflight; `ARGOS_CORS_ORIGINS` is logged at
  startup.
- [Front-side limits drift from `schemas.py`] → constants carry a pointer comment; the API
  remains authoritative and its 413/422 are rendered helpfully.
- [Key in browser storage is readable by any script on the origin] → strict CSP, no
  third-party code, session storage by default, one-click forget.
- [Estimated duration is wrong under load or for slow presets] → labelled as approximate;
  the elapsed counter is the truth; the bar never reaches 100 % before the answer arrives.
- [Page is public; anyone can open it] → harmless: nothing works without a key, and the
  API's auth, limits and queue are unchanged.
- [Pi resources] → nginx:alpine serving static files adds a few MB of RAM.

## Migration Plan

1. Build the web image ahead (`docker compose build` in `web/`) so the switch is quick.
2. Deploy the API with CORS and the new host rule (`docker compose up -d --build` in
   `server/`): Traefik requests the `argos-api.` certificate; the model reloads (~65 s,
   `503 loading`, as on any restart). The old host has no router for these seconds.
3. Immediately `docker compose up -d` in `web/`: the old host now serves the wizard and
   308-redirects API paths.
4. Verify: `https://argos-api.northernarchive.com/health` 200, a preset call, Postman via
   newman against the new base URL, `/docs` redirect from the old host, wizard end to end.
5. Rollback: `docker compose down` in `web/` and restore the old `Host` rule in
   `server/docker-compose.yml` (`git revert` of the compose change) + `up -d`.
