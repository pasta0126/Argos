# argos-web

Wizard web para construir peticiones a la API de Argos paso a paso, enviarlas y entender la
respuesta: barras de probabilidad por opción/nivel, sí/no, confianza, y el JSON exacto de
petición y respuesta. Público en <https://argos.northernarchive.com>; llama a la API en
<https://argos-api.northernarchive.com> (CORS permitido para este origen por
`ARGOS_CORS_ORIGINS` en `server/.env`).

Pasos: clave → modo (preset, personalizado o ejemplo de `server/examples/`) → texto →
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

En dev `VITE_API_URL` está vacío y Vite hace de proxy (sin CORS). Para apuntar a otro
despliegue: `API_PROXY_TARGET=https://otro-host npm run dev`.

La lógica está en `src/lib/` (funciones puras, con tests): `draft.js` (borrador →
petición exacta, `buildRequest`), `validate.js` (mismos límites que
`server/argos_api/schemas.py`; si cambian allí, cámbialos en `limits.js`), `api.js`
(llamadas, reintentos ante `503` con `Retry-After`, mensajes de error en español, curl),
`answerView.js` (respuesta → barras).

## Despliegue (en void-server)

```bash
cd ~/argos/web
docker compose up -d --build
curl -sI https://argos.northernarchive.com/ | head -1
```

La imagen se construye con el repo como contexto (incluye `server/examples/`); la URL de
la API se fija al construir (`ARG VITE_API_URL`, por defecto la de producción). nginx sirve
el build con CSP estricta y redirige con `308` las rutas antiguas de la API en este host
(`/v1/*`, `/health`, `/docs`, `/redoc`, `/openapi.json`) a `argos-api.northernarchive.com`.
Desplegar o parar el front no toca el contenedor `argos-api`.
