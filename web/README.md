# argos-web

Wizard web para construir peticiones a la API de Argos paso a paso, enviarlas y entender la
respuesta: barras de probabilidad por opción/nivel, sí/no, confianza, y el JSON exacto de
petición y respuesta. Llama a la API de Argos desde el navegador (`ARGOS_API_URL`); la API debe permitir el
origen del wizard en `ARGOS_CORS_ORIGINS` (`server/.env`).

Pasos: clave → modo (personalizado por defecto, o uno de los presets) → texto →
preguntas → opciones (`min_confidence`) → revisar y enviar → resultado (Visual · Payload ·
Respuesta · curl).

Debajo de los presets está el grupo **Oráculo**, con su propio tema (claro y oscuro):
`POST /v1/oracle/yesno` (sí o no) y `POST /v1/oracle/8ball` (bola 8 mágica). En modo oráculo
el paso de texto pide la pregunta (máximo 500 caracteres; el oráculo sí/no avisa de que hay
que preguntar algo que se conteste con sí o no), el de preguntas muestra la instrucción fija
(y las 20 frases de la bola), y el umbral de confianza queda desmarcado y deshabilitado: la
petición es solo `{"question": ...}`. Al volver a personalizado o a un preset se recupera el
umbral que tenías. El resultado es un Sí / No grande, o la bola con la frase ganadora, una
barra por frase coloreada por clase y los totales afirmativo, neutro y negativo.

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
`answerView.js` (respuesta → barras, también las vistas del oráculo) y `oracles.js` (los
dos oráculos, sus frases y la duración estimada; copia de `server/argos_api/oracle.py`).

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
