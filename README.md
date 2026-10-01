<p align="center">
  <img src="icon.png" alt="Argos" width="140" />
</p>

# Argos

Argos responde preguntas sobre un texto. Le envías un texto (un mensaje de un cliente, un
correo, un comentario…) y una o varias preguntas, y devuelve la respuesta a cada una con su
probabilidad. Las preguntas pueden ser de tres tipos: elegir una opción, situar el texto en
una escala, o sí/no.

Por dentro usa [Laya](https://laya.convaiinnovations.com/) (`laya-multilingual`), un modelo
de decisión que no genera texto: solo elige entre las respuestas que le das. Corre en una
Raspberry Pi, sin GPU.

| | |
|---|---|
| **Wizard web** | <https://argos.northernarchive.com> |
| **API** | <https://argos-api.northernarchive.com> |
| **Documentación interactiva** | <https://argos-api.northernarchive.com/docs> |

## Wizard web

Para probar Argos sin escribir JSON. Te guía paso a paso:

1. **Clave**: tu API key. Se guarda solo en tu navegador.
2. **Modo**: preguntas personalizadas (por defecto) o uno de los cinco presets.
3. **Texto** que quieres analizar.
4. **Preguntas**: con un preset, eliges cuáles responder. En modo personalizado, las montas
   tú (opciones, escala o sí/no).
5. **Opciones**: umbral de confianza opcional.
6. **Revisar y enviar.**

Mientras rellenas los pasos se ve el JSON que se va a enviar. En el resultado tienes la
respuesta en gráfico (barras de probabilidad, escala, sí/no y confianza), el JSON enviado,
el JSON recibido y el `curl` equivalente. En todo momento se ve qué está pasando: si el
modelo está cargando, si se está enviando, si el servidor está ocupado (se reintenta solo)
y, si algo falla, por qué.

## API en 30 segundos

```bash
curl -s https://argos-api.northernarchive.com/v1/decide \
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

Todo `/v1/*` requiere `Authorization: Bearer <key>`. Límites: 8.000 caracteres de texto,
10 preguntas y 20 opciones por pregunta. Las peticiones se atienden de una en una, con una
cola corta. Una pregunta tarda ~1 s; un preset completo, 7–12 s.

> **Cambio de dominio (v0.5.0):** la API estaba antes en `argos.northernarchive.com`, donde
> ahora está el wizard. Las rutas antiguas de la API responden `308` al nuevo host, pero
> `curl -L` pierde la cabecera `Authorization` al cambiar de host, así que actualiza la
> URL en tus scripts.

### Qué esperar del modelo

- **Fiable:** clasificar en una de varias opciones (`choice`) y preguntas sí/no concretas
  y bien redactadas.
- **Poco fiable:** las escalas (`score`); úsalas como orientación.
- **La redacción importa mucho.** Dos formulaciones casi iguales pueden dar 97 % y 1 %.
  Prueba tus preguntas con textos reales antes de automatizar nada.
- **Una confianza alta no garantiza acierto.** Para decisiones automáticas, una técnica
  que funciona es hacer dos preguntas `choice` con redacción distinta y aceptar la
  respuesta solo cuando coinciden.

Precisión medida por preset y consejos: [`server/README.md`](server/README.md#using-laya-well).

## Estructura

```
server/   API (Python 3.12, FastAPI + uvicorn) que envuelve Laya. Docker Compose propio.
web/      Wizard (Vite + React 19, estático servido por nginx). Docker Compose propio.
openspec/ Requisitos (specs/) y decisiones de diseño de cada cambio (changes/archive/).
```

Las dos piezas se despliegan por separado detrás de Traefik, en `void-server` (Raspberry
Pi 4B, arm64). Desplegar o parar el wizard no reinicia la API, que tarda ~1 minuto en
cargar el modelo.

## Documentación

| Para… | Lee |
|---|---|
| Usar la API: cada endpoint con peticiones y respuestas reales | [`server/API.md`](server/API.md) |
| Probarla en 5 minutos (testers) | [`server/TESTING.md`](server/TESTING.md) |
| Configurar, desarrollar y desplegar la API; rendimiento y precisión | [`server/README.md`](server/README.md) |
| Desarrollar y desplegar el wizard | [`web/README.md`](web/README.md) |
| Colección de Postman | [`server/postman/`](server/postman/) |
| Requisitos actuales | [`openspec/specs/`](openspec/specs/) |

## Desarrollo rápido

```bash
# API: tests rápidos (motor falso, sin torch)
cd server && .venv/bin/python -m pytest

# Wizard: tests, lint y servidor de desarrollo
cd web && npm install && npm test && npm run lint && npm run dev

# Despliegue en void-server
cd server && docker compose up -d --build
cd web && docker compose up -d --build
```

Los cambios de diseño se proponen y documentan con [OpenSpec](https://github.com/Fission-AI/OpenSpec)
(`openspec/`). Ver [`CLAUDE.md`](CLAUDE.md).

## Licencia

Dominio público ([Unlicense](LICENSE)).
