<p align="center">
  <img src="icon.png" alt="Argos" width="140" />
</p>

# Argos

Argos es una API HTTP que puedes alojar en tu propio servidor y que responde preguntas sobre
un texto. Le envías un texto (un mensaje de un cliente, un correo, un comentario…) y una o
varias preguntas, y te devuelve la respuesta a cada una con su probabilidad. Las preguntas
pueden ser de tres tipos: elegir una opción, situar el texto en una escala, o sí/no.

Por dentro usa [Laya](https://laya.convaiinnovations.com/) (`laya-multilingual`), un modelo
de decisión que no genera texto: solo elige entre las respuestas que le das. Funciona solo
con CPU, incluso en una Raspberry Pi 4. Incluye además un **wizard web** opcional para
montar preguntas paso a paso y ver las respuestas en gráfico.

```
Tu app / curl ──► argos-api (FastAPI + Laya) ◄── argos-web (wizard, opcional)
```

## Qué necesitas

- **Docker** con Docker Compose v2.
- **Memoria:** ~2,1 GB de RAM para la API en uso normal y ~2,6 GB de pico. El wizard es un
  nginx con ficheros estáticos y apenas consume.
- **CPU:** arm64 o amd64; no hace falta GPU. Con 3 hilos en una Raspberry Pi 4, una pregunta
  tarda ~1 s y cinco preguntas, 7–12 s. Las inferencias se atienden de una en una.
- **Disco:** ~1,6 GB de imagen de la API más ~650 MB de pesos del modelo, que se descargan
  de Hugging Face en el primer arranque.
- **Un proxy inverso con HTTPS** si la vas a exponer a internet. Los `docker-compose.yml`
  traen etiquetas para **Traefik v3**: red externa `proxy`, entrypoint `websecure` y
  certresolver `le`. Si usas otro proxy, mira [Sin Traefik](#sin-traefik).

## Montar la API

```bash
git clone https://github.com/pasta0126/Argos.git
cd argos/server
cp .env.example .env
```

Edita `server/.env`:

```bash
# Dominio público de la API. Crea su registro DNS apuntando a tu servidor.
ARGOS_API_HOST=argos-api.tu-dominio.com

# Una clave por cliente, formato id:clave. Genera cada clave con: openssl rand -hex 32
ARGOS_API_KEYS=miapp:CLAVE_LARGA_ALEATORIA,cli:OTRA_CLAVE

# Origen del wizard web, si lo vas a montar (CORS). Vacío = sin CORS.
ARGOS_CORS_ORIGINS=https://argos.tu-dominio.com

# Commit del modelo en Hugging Face (fijado para que los pesos no cambien solos).
ARGOS_MODEL_REVISION=55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851

# Hilos de CPU y peticiones que pueden esperar turno (más allá → 503 "busy").
ARGOS_THREADS=3
ARGOS_MAX_QUEUE=4
```

Sin claves, el servicio se niega a arrancar. No uses `$` en los valores. Si tu Traefik no
usa los nombres por defecto, define `TRAEFIK_NETWORK` (`proxy`), `TRAEFIK_ENTRYPOINT`
(`websecure`) y `TRAEFIK_CERTRESOLVER` (`le`).

Arranca:

```bash
docker compose up -d --build
docker compose logs -f argos-api     # espera a "model laya-multilingual loaded"
curl -s https://argos-api.tu-dominio.com/health
# {"status":"ok","model":"laya-multilingual"}
```

El primer arranque descarga los pesos (~650 MB) a un volumen Docker. Después, cada
arranque tarda ~1 minuto en cargar el modelo; mientras tanto `/health` y las decisiones
responden `503` con `Retry-After`.

## Montar el wizard (opcional)

El wizard es una web estática que llama a tu API desde el navegador. Cada usuario introduce
su propia clave, que se guarda solo en su navegador.

```bash
cd argos/web
cp .env.example .env
```

Edita `web/.env`:

```bash
# Dominio público del wizard. Crea su registro DNS apuntando a tu servidor.
ARGOS_WEB_HOST=argos.tu-dominio.com

# URL de tu API tal como la ve el navegador.
ARGOS_API_URL=https://argos-api.tu-dominio.com
```

Arranca:

```bash
docker compose up -d --build
```

`ARGOS_CORS_ORIGINS` en `server/.env` debe ser exactamente el origen del wizard
(`https://argos.tu-dominio.com`, sin barra final); si lo cambias, aplica con
`docker compose up -d` en `server/`. La URL de la API queda fija en el build: si cambia,
vuelve a construir.

Si el dominio del wizard servía antes la API, define también `ARGOS_LEGACY_API_URL` en
`web/.env` para que sus rutas antiguas (`/v1/*`, `/health`, `/docs`…) respondan `308` a la
nueva URL.

En el wizard eliges preguntas personalizadas o uno de los presets, escribes el texto y
envías. Mientras rellenas los pasos se ve el JSON que se enviará. En el resultado tienes
barras de probabilidad, el JSON enviado, el JSON recibido y el `curl` equivalente, y en
todo momento se ve qué está pasando: modelo cargando, enviando, servidor ocupado (con
reintento automático) o el motivo de un error.

## Sin Traefik

Quita las `labels` y la red `proxy` de los `docker-compose.yml` y publica los puertos:

```yaml
services:
  argos-api:
    ports:
      - "127.0.0.1:8080:8080"   # la API escucha en el 8080
```

El wizard escucha en el 80 del contenedor. Pon delante tu proxy (nginx, Caddy…) con HTTPS.
Para probar solo en local, basta con `curl http://localhost:8080/health`; en ese caso no
dejes la API abierta a internet sin HTTPS. Sin etiquetas, `ARGOS_API_HOST`,
`ARGOS_WEB_HOST` y las variables `TRAEFIK_*` dejan de hacer falta; `ARGOS_API_URL` sigue
siendo obligatoria para construir el wizard.

## Usar la API

```bash
curl -s https://argos-api.tu-dominio.com/v1/decide \
  -H "Authorization: Bearer $ARGOS_KEY" -H 'Content-Type: application/json' -d '{
  "text": "Me han cobrado dos veces este mes. Quiero un reembolso.",
  "questions": {
    "departamento": {
      "type": "choice",
      "instructions": "¿Qué departamento debe gestionarlo?",
      "criteria": { "facturacion": "pagos, facturas, reembolsos", "tecnico": "errores, caídas" }
    },
    "reembolso": { "type": "yesno", "instructions": "¿Pide un reembolso?" }
  }
}'
```

| Endpoint | Qué hace |
|---|---|
| `POST /v1/decide` | Responde tus propias preguntas sobre un texto |
| `GET /v1/presets` | Lista los conjuntos de preguntas ya preparados |
| `POST /v1/presets/{triage,guard,email,moderation,router}` | Responde un preset (solo envías el texto) |
| `GET /health` | Indica si el modelo está cargado (público) |
| `GET /docs` | Swagger: documentación interactiva |

Todo `/v1/*` requiere `Authorization: Bearer <clave>`. Límites: 8.000 caracteres de texto,
10 preguntas y 20 opciones por pregunta.

Referencia completa con peticiones y respuestas reales: [`server/API.md`](server/API.md).
Colección de Postman: [`server/postman/`](server/postman/).

## Gestionar claves

Cada clave de `ARGOS_API_KEYS` tiene un identificador (`miapp:…`) que aparece en los logs.
El texto de las peticiones nunca se registra. Para dar acceso a alguien, añade una pareja
`id:clave`; para revocarlo, quítala. En ambos casos aplica el cambio con
`docker compose up -d` en `server/`.

## Qué esperar del modelo

- **Fiable:** clasificar en una de varias opciones (`choice`) y preguntas sí/no concretas
  y bien redactadas.
- **Poco fiable:** las escalas (`score`); úsalas como orientación.
- **La redacción importa mucho.** Dos formulaciones casi iguales pueden dar 97 % y 1 %.
  Prueba tus preguntas con textos reales antes de automatizar nada.
- **Una confianza alta no garantiza acierto.** Para decisiones automáticas, una técnica
  que funciona es hacer dos preguntas `choice` con redacción distinta y aceptar la
  respuesta solo cuando coinciden.

Precisión medida por preset y más consejos: [`server/README.md`](server/README.md#using-laya-well).

## Actualizar

```bash
cd argos && git pull
cd server && docker compose up -d --build
cd ../web && docker compose up -d --build
```

Revisa antes las notas de cada versión (tags `v*`). Si cambias `ARGOS_MODEL_REVISION`, se
descargan pesos nuevos y las respuestas pueden variar.

## Estructura y desarrollo

```
server/   API (Python 3.12, FastAPI + uvicorn) que envuelve Laya
web/      Wizard (Vite + React 19, estático servido por nginx)
openspec/ Requisitos (specs/) y decisiones de diseño de cada cambio (changes/archive/)
```

| Para… | Lee |
|---|---|
| Desarrollar la API: tests, configuración, rendimiento | [`server/README.md`](server/README.md) |
| Desarrollar el wizard | [`web/README.md`](web/README.md) |
| Probar la API en 5 minutos | [`server/TESTING.md`](server/TESTING.md) |

```bash
cd server && .venv/bin/python -m pytest          # tests de la API (motor falso, sin torch)
cd web && npm install && npm test && npm run dev  # tests y servidor de desarrollo del wizard
```

## Licencia

Dominio público ([Unlicense](LICENSE)).
