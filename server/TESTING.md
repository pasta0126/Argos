# Guía rápida de pruebas — Argos API

Para testers: cómo comprobar en 5 minutos que la API funciona y cómo probar casos propios.
Argos es una API HTTP; para probarla sin escribir JSON está el wizard web (abajo). Le envías un texto y unas preguntas, y te
devuelve la respuesta a cada pregunta con su probabilidad.

- URL base: `https://argos-api.northernarchive.com` (antes `argos.northernarchive.com`, que ahora es el wizard web y
  redirige con `308`; `curl -L` pierde la clave al cambiar de host, cambia la URL)
- Wizard web (sin escribir JSON): <https://argos.northernarchive.com>
- Referencia de cada endpoint con ejemplos de petición y respuesta: [`API.md`](API.md)
- Swagger (documentación interactiva): <https://argos-api.northernarchive.com/docs>
- Colección de Postman: [`postman/argos.postman_collection.json`](postman/argos.postman_collection.json)
- Ejemplos de petición: [`examples/`](examples/)

## 0. Antes de empezar

Necesitas una **API key**. Pídesela al responsable del servicio; no la compartas ni la
subas a git. Todas las llamadas a `/v1/*` la llevan en la cabecera:

```
Authorization: Bearer <tu-api-key>
```

## 1. Prueba de humo (30 segundos)

```bash
curl -s https://argos-api.northernarchive.com/health
```

| Respuesta | Significado |
|---|---|
| `200 {"status":"ok","model":"laya-multilingual"}` | Listo para usar |
| `503 {"status":"loading"}` | Arrancando: el modelo tarda ~65 s en cargar. Reintenta en un minuto |
| Error de conexión | El servicio está caído: avisa |

## 2. Primera decisión

Elige el cliente que prefieras. Las tres opciones hacen la misma petición.

### Opción A — Swagger (navegador, sin instalar nada)

1. Abre <https://argos-api.northernarchive.com/docs>.
2. Pulsa **Authorize** (arriba a la derecha), pega la API key **sola, sin escribir "Bearer"**,
   pulsa **Authorize** y cierra el diálogo. Vale para todas las llamadas hasta que recargues.
3. Despliega `POST /v1/decide` → **Try it out**.
4. Pega en el cuerpo el contenido de [`examples/ticket-department.json`](examples/ticket-department.json) → **Execute**.

### Opción B — Postman

1. **Import** → arrastra `postman/argos.postman_collection.json`.
2. Abre la colección **Argos API** → pestaña **Variables** → pon tu key en `apiKey`
   (columna *Current value*) → **Save**.
3. Ejecuta **Health** y luego cualquier petición de la carpeta **Ejemplos**.
4. La pestaña **Test Results** de cada respuesta dice si el resultado es el esperado.
   Para lanzar todo de golpe: botón derecho en la colección → **Run collection**.

La autenticación se configura en la colección y la heredan todas las peticiones; no hay
que añadir la cabecera a mano.

### Opción C — curl

```bash
export ARGOS_KEY=<tu-api-key>
cd server/examples

curl -s https://argos-api.northernarchive.com/v1/decide \
  -H "Authorization: Bearer $ARGOS_KEY" \
  -H 'Content-Type: application/json' \
  -d @ticket-department.json
```

(Añade `| python3 -m json.tool` o `| jq` al final para ver el JSON formateado.)

### Resultado esperado

```json
{
  "answers": {
    "department": {
      "choice": "technical",
      "probabilities": {"billing": 0.0041, "technical": 0.9811, "sales": 0.004, "other": 0.0108},
      "confidence": 0.9811
    }
  },
  "model": "laya-multilingual",
  "latency_ms": 1515
}
```

Las probabilidades pueden variar en los decimales; lo que debe coincidir es la respuesta
(`choice`, `level`, `answer`). Cada pregunta tarda ~1–1,5 s.

## 3. Cómo se escribe una petición

```json
{
  "text": "El texto a analizar (máx. 8.000 caracteres)",
  "questions": {
    "<nombre-libre>": { "type": "choice | score | yesno", "instructions": "La pregunta", "criteria": ... }
  },
  "min_confidence": 0.8
}
```

| `type` | Para qué | `criteria` | Qué devuelve |
|---|---|---|---|
| `choice` | Elegir una opción entre varias | Objeto `etiqueta → descripción` (2–20) | `choice`: la etiqueta ganadora |
| `score` | Situar en una escala | Lista de niveles, **de menor a mayor** (2–20) | `level`: nivel más cercano; `score`: posición 0…n−1 (con decimales) |
| `yesno` | Sí / no | Opcional: `{"yes": "...", "no": "..."}` | `answer`: true/false; `probability`: P(sí) |

- Todas las respuestas incluyen `confidence` (la probabilidad más alta, de 0 a 1).
- `min_confidence` es opcional. Si lo pones, cada respuesta trae `low_confidence: true`
  cuando la confianza no llega al umbral. Nunca se oculta una respuesta.
- Máximo 10 preguntas por petición. Cuantas más preguntas, más tarda (~1 s cada una).

## 4. Modelos de ejemplo

Están en [`examples/`](examples/) y también en la carpeta **Ejemplos** de Postman. Copia
uno y cambia el texto o las preguntas para probar tus propios casos.

| Archivo | Caso de uso | Preguntas | Resultado esperado |
|---|---|---|---|
| `ticket-department.json` | Enrutar un ticket de soporte | `department` (choice) | `technical` (0,98) |
| `ticket-full.json` | Ticket completo: departamento, urgencia, reembolso | choice + score + yesno | `billing` (1,0) · `bloqueante` (0,62, **low_confidence**) · `refund: true` (0,99) |
| `review-opinion.json` | Opinión de una reseña de producto | `opinion` (choice) + `rating` (score 3 niveles) | `positive` (0,99) · `bien` (0,80) |
| `comment-moderation.json` | Detectar insultos en un comentario | `offensive` (yesno con criterios) | `true` (0,93) |
| `email-triage.json` | Clasificar un correo entrante | `intent` (choice) + `proposes_date` (yesno) | `meeting` (0,98) · `true` (0,90) |

`ticket-full.json` sirve para ver `low_confidence`: la urgencia sale "bloqueante" con
0,62, por debajo del umbral de 0,8, así que se marca para revisión.

## 5. Presets: preguntas ya preparadas

Para casos frecuentes no hace falta escribir preguntas: cada preset tiene su propio endpoint y
le envías solo el texto. En Swagger están en el grupo **presets**, con sus preguntas descritas.
La lista completa está en `GET /v1/presets`.

| Endpoint | Para qué | Preguntas |
|---|---|---|
| `POST /v1/presets/triage` | Mensajes de clientes | `intent`, `is_urgent`, `frustration`, `refund_requested`, `churn_risk` |
| `POST /v1/presets/guard` | Mensajes dirigidos a un asistente de IA | `jailbreak`, `prompt_injection`, `sensitive_data`, `harm_severity`, `topic` |
| `POST /v1/presets/email` | Correos entrantes | `category`, `is_spam`, `is_phishing`, `urgency`, `needs_reply` |
| `POST /v1/presets/moderation` | Comentarios de usuarios | `toxic`, `harassment`, `threat`, `spam`, `severity` |
| `POST /v1/presets/router` | Peticiones a un modelo de lenguaje | `difficulty`, `domain`, `needs_tools`, `is_sensitive` |

```bash
curl -s https://argos-api.northernarchive.com/v1/presets/triage \
  -H "Authorization: Bearer $ARGOS_KEY" \
  -H 'Content-Type: application/json' \
  -d @preset-triage.json
```

| Archivo | Resultado esperado |
|---|---|
| `preset-triage.json` | `intent: refund` · `refund_requested: true` · `is_urgent: false` · `churn_risk: false` |
| `preset-guard.json` | `jailbreak: true` · `prompt_injection: true` · `sensitive_data: false` |
| `preset-email.json` | `category: billing` · `is_spam: false` · `is_phishing: false` |
| `preset-moderation.json` | `toxic: true` · `harassment: true` · `threat: false` · `spam: false` |
| `preset-router.json` | `domain: code` · `needs_tools: false` |

Las respuestas completas, con probabilidades, están en [`API.md`](API.md#endpoints-de-presets).

- La respuesta es igual que la de `/v1/decide`, con un campo `preset` añadido.
- Un preset completo tarda 7–11 s. Para responder solo algunas preguntas usa
  `"questions": ["jailbreak"]`: es bastante más rápido.
- Una pregunta que el preset no tiene da `422` y el error lista las válidas.

## 5b. Oráculo: solo una pregunta

Dos endpoints de juguete en el grupo **oracle** de Swagger (carpeta **Oráculo** de Postman).
Solo se envía `{"question": "..."}` (máximo 500 caracteres). La instrucción es fija y no hay
umbral de confianza.

| Endpoint | Responde | Tarda |
|---|---|---|
| `POST /v1/oracle/yesno` | `answer` (sí/no), `probability` (P(sí)) y `confidence` | ~1–1,5 s |
| `POST /v1/oracle/8ball` | la frase ganadora de las 20 de la bola 8, el porcentaje de cada una (suman 100) y los totales afirmativo, neutro y negativo | ~4 s |

```bash
curl -s https://argos-api.northernarchive.com/v1/oracle/8ball \
  -H "Authorization: Bearer $ARGOS_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"question": "¿Me tocará la lotería este año?"}'
```

- **No hay respuesta correcta**: comprueba la forma de la respuesta, no lo que dice. La
  misma pregunta da siempre la misma respuesta.
- El oráculo sí/no responde sí o no **a cualquier pregunta**, también a las abiertas
  ("¿Qué color de coche me compro?"). No es un fallo: hacer preguntas de sí o no es cosa de
  quien pregunta.
- `min_confidence`, `text` o cualquier otro campo dan `422`; más de 500 caracteres, `413`.

## 6. Errores que deberías poder reproducir

Están en la carpeta **Errores** de Postman.

| Código | Cuándo | Cómo provocarlo |
|---|---|---|
| `401` | Falta la API key o es incorrecta | Quita la cabecera `Authorization` |
| `404` | Preset que no existe | `POST /v1/presets/horoscope` |
| `422` | JSON mal formado o campo inválido; el cuerpo indica el campo | `"type": "maybe"`, falta `instructions`, un campo desconocido, una pregunta que el preset no tiene… |
| `413` | Supera los límites | Texto > 8.000 caracteres, > 10 preguntas, > 20 opciones, pregunta del oráculo > 500 caracteres |
| `503` | Modelo cargando (`loading`) o servidor saturado (`busy`) | Llamar justo tras un reinicio, o > 5 peticiones simultáneas. Respeta `Retry-After` |

## 7. Limitaciones conocidas (no son bugs del servicio)

El modelo (Laya) es aproximado, no infalible. Esto ya lo hemos observado:

- **Escalas de 5 niveles sesgadas a la baja.** Con estrellas del 1 al 5, una reseña
  entusiasta ("Me encanta… Lo recomiendo") sale "2 estrellas" con 0,61 de confianza. Con 3
  niveles (`mal`/`normal`/`bien`) o con `choice` acierta. Usa escalas cortas.
- **Opiniones mixtas** ("correcto, *aunque* la caja venía golpeada") dan resultados poco
  fiables.
- **Negaciones y condicionales** ("*Si no* lo arregláis me doy de baja") se detectan mal.
- **Preguntas abstractas** como "¿necesita respuesta este correo?" fallan aunque el correo
  haga una pregunta directa (salió `false` con 0,96). Funcionan mejor las preguntas
  concretas sobre el texto: "¿Propone una fecha para reunirse?" → `true`.
- Una confianza alta **no garantiza** que la respuesta sea correcta (ver los dos casos
  anteriores).
- No uses `yes`/`no`/`true`/`false` como etiquetas de un `choice`: usa `yesno`.

Si cambiar la redacción de la pregunta o de los criterios cambia el resultado, es normal:
forma parte de lo que hay que probar.

## 8. Qué incluir al reportar un fallo

1. El cuerpo JSON completo enviado (sin la API key).
2. La respuesta completa (código HTTP + cuerpo).
3. Qué esperabas y por qué.
4. Hora aproximada de la llamada (para buscarla en los logs; el texto enviado no se guarda
   en los logs, solo los metadatos).
