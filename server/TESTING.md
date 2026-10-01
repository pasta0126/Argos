# Guía rápida de pruebas — Argos API

Para testers: cómo comprobar en 5 minutos que la API funciona y cómo probar casos propios.
Argos no tiene pantalla: es una API HTTP. Le envías un texto y unas preguntas, y te
devuelve la respuesta a cada pregunta con su probabilidad.

- URL base: `https://argos.northernarchive.com`
- Referencia de cada endpoint con ejemplos de petición y respuesta: [`API.md`](API.md)
- Swagger (documentación interactiva): <https://argos.northernarchive.com/docs>
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
curl -s https://argos.northernarchive.com/health
```

| Respuesta | Significado |
|---|---|
| `200 {"status":"ok","model":"laya-multilingual"}` | Listo para usar |
| `503 {"status":"loading"}` | Arrancando: el modelo tarda ~65 s en cargar. Reintenta en un minuto |
| Error de conexión | El servicio está caído: avisa |

## 2. Primera decisión

Elige el cliente que prefieras. Las tres opciones hacen la misma petición.

### Opción A — Swagger (navegador, sin instalar nada)

1. Abre <https://argos.northernarchive.com/docs>.
2. Pulsa **Authorize** (arriba a la derecha), pega la API key y confirma.
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

curl -s https://argos.northernarchive.com/v1/decide \
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

Para algunos casos frecuentes no hace falta escribir preguntas: cada preset tiene su propio
endpoint y le envías solo el texto: `POST /v1/presets/triage` o `POST /v1/presets/guard`. En
Swagger están en el grupo **presets**, con sus preguntas descritas. La lista completa está en
`GET /v1/presets`.

| Preset | Para qué | Preguntas |
|---|---|---|
| `triage` | Mensajes de clientes | `intent` (refund, technical_help, billing_question, information, cancellation, other), `refund_requested`, `churn_risk` |
| `guard` | Mensajes dirigidos a un asistente de IA | `jailbreak`, `prompt_injection`, `sensitive_data` |

```bash
curl -s https://argos.northernarchive.com/v1/presets/triage \
  -H "Authorization: Bearer $ARGOS_KEY" \
  -H 'Content-Type: application/json' \
  -d @preset-triage.json
```

| Archivo | Resultado esperado |
|---|---|
| `preset-triage.json` | `intent: refund` (0,997) · `refund_requested: true` (0,997) · `churn_risk: false` (0,68, **low_confidence**) |
| `preset-guard.json` | `jailbreak: true` (0,98) · `prompt_injection: true` (0,96) · `sensitive_data: false` (0,71) |

- La respuesta es igual que la de `/v1/decide`, con un campo `preset` añadido.
- Para responder solo algunas preguntas: `"questions": ["jailbreak"]`. Es más rápido:
  `triage` completo tarda ~5,5 s, `guard` ~3 s.
- Una pregunta que el preset no tiene da `422` y el error lista las válidas.
- Fallos conocidos: `jailbreak` y `prompt_injection` saltan con mensajes que solo contienen
  datos personales; `refund_requested` salta con quejas que no piden dinero. Los aciertos
  medidos están en el README; es una muestra pequeña.

## 6. Errores que deberías poder reproducir

Están en la carpeta **Errores** de Postman.

| Código | Cuándo | Cómo provocarlo |
|---|---|---|
| `401` | Falta la API key o es incorrecta | Quita la cabecera `Authorization` |
| `404` | Preset que no existe | `POST /v1/presets/horoscope` |
| `422` | JSON mal formado o campo inválido; el cuerpo indica el campo | `"type": "maybe"`, falta `instructions`, un campo desconocido, una pregunta que el preset no tiene… |
| `413` | Supera los límites | Texto > 8.000 caracteres, > 10 preguntas, > 20 opciones |
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
