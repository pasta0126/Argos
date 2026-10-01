# argos-web

Wizard web para construir peticiones a la API de Argos paso a paso, enviarlas y entender la
respuesta: barras de probabilidad por opción/nivel, sí/no, confianza, y el JSON exacto de
petición y respuesta. Llama a la API de Argos desde el navegador (`ARGOS_API_URL`); la API debe permitir el
origen del wizard en `ARGOS_CORS_ORIGINS` (`server/.env`).

Pasos: clave → modo (personalizado por defecto, o uno de los presets) → texto →
preguntas → opciones (`min_confidence`) → revisar y enviar → resultado (Visual · Payload ·
Respuesta · curl).

La clave API se guarda solo en el navegador: `sessionStorage` por defecto, `localStorage`
si se marca «Recordar». Nunca aparece en el JSON ni en el curl mostrados (`$ARGOS_KEY`).

## Desarrollo

Vite + React 19, sin librería de gráficos (barras en CSS). Node ≥ 20.19.

```bash
cd ~/argos/web
npm install
npm run dev        # http://localhost:5173, /v1 y /health van por proxy a la API de producción
npm test           # vitest: construcción de la petición, validación, cliente API, visualización
npm run lint       # oxlint
npm run build
```

En dev `VITE_API_URL` está vacío y Vite hace de proxy (sin CORS) hacia `ARGOS_API_URL` de
`web/.env` (o `http://localhost:8080` sin `.env`). Para apuntar a otro despliegue:
`API_PROXY_TARGET=https://otro-host npm run dev`.

La lógica está en `src/lib/` (funciones puras, con tests): `draft.js` (borrador →
petición exacta, `buildRequest`), `validate.js` (mismos límites que
`server/argos_api/schemas.py`; si cambian allí, cámbialos en `limits.js`), `api.js`
(llamadas, reintentos ante `503` con `Retry-After`, mensajes de error en español, curl),
`answerView.js` (respuesta → barras).

## Despliegue

```bash
cd web
cp .env.example .env     # ARGOS_WEB_HOST, ARGOS_API_URL (y opcionalmente ARGOS_LEGACY_API_URL)
docker compose up -d --build
```

La imagen se construye solo con `web/`. `ARGOS_API_URL` se pasa al build como
`VITE_API_URL` (sin ella el build falla) y, al arrancar, el nginx oficial rellena las
plantillas de `nginx/` con las variables `ARGOS_*`: la CSP solo permite conectar con esa
URL. Si se define `ARGOS_LEGACY_API_URL`, `nginx/40-argos-legacy-redirects.sh` genera
redirecciones `308` de las rutas antiguas de la API (`/v1/*`, `/health`, `/docs`, `/redoc`,
`/openapi.json`) a esa URL; sin ella no hay redirecciones. Los nombres de Traefik se pueden
cambiar con `TRAEFIK_NETWORK`, `TRAEFIK_ENTRYPOINT` y `TRAEFIK_CERTRESOLVER`. Desplegar o
parar el front no toca el contenedor `argos-api`.
