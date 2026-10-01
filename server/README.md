# argos-api

HTTP API over the [Laya](https://laya.convaiinnovations.com/) decision engine
(`laya-multilingual` checkpoint): send a text plus typed questions, get calibrated
answers. Public at `https://argos.northernarchive.com`.

## API

All `/v1/*` endpoints need `Authorization: Bearer <key>` (keys in `.env`, see below).

There is no UI beyond the auto-generated API docs:

- **Swagger UI:** <https://argos.northernarchive.com/docs> (**Authorize** → paste the key →
  *Try it out*); OpenAPI schema at `/openapi.json`.
- **Postman:** import [`postman/argos.postman_collection.json`](postman/argos.postman_collection.json)
  and set the `apiKey` collection variable. It has `/health`, the [`examples/`](examples/)
  requests with expected-result tests, and 401/422/413 cases. Headless:
  `npx -y newman run postman/argos.postman_collection.json --env-var apiKey=$ARGOS_KEY`.
- **Quick-test guide for testers** (Spanish): [`TESTING.md`](TESTING.md).

### `POST /v1/decide`

```bash
curl -s https://argos.northernarchive.com/v1/decide \
  -H "Authorization: Bearer $ARGOS_KEY" -H 'content-type: application/json' -d '{
  "text": "Me han cobrado dos veces este mes. Quiero un reembolso.",
  "questions": {
    "department": {"type": "choice", "instructions": "¿Qué departamento debe gestionarlo?",
                   "criteria": {"billing": "pagos, facturas, reembolsos",
                                "technical": "errores, caídas, fallos técnicos",
                                "other": "todo lo demás"}},
    "urgency":    {"type": "score", "instructions": "¿Cómo de urgente es?",
                   "criteria": ["nada urgente", "pronto", "bloqueante"]},
    "refund":     {"type": "yesno", "instructions": "¿Pide un reembolso?"}
  },
  "min_confidence": 0.8
}'
```

```json
{
  "answers": {
    "department": {"choice": "billing", "probabilities": {"billing": 1.0, "technical": 0.0, "other": 0.0},
                   "confidence": 1.0, "low_confidence": false},
    "urgency": {"score": 1.5913, "level": "bloqueante", "probabilities": [0.0303, 0.3482, 0.6215],
                "confidence": 0.6215, "low_confidence": true},
    "refund": {"probability": 0.9963, "answer": true, "confidence": 0.9963, "low_confidence": false}
  },
  "model": "laya-multilingual",
  "latency_ms": 2837
}
```

Question types:

| type | `criteria` | answer |
|---|---|---|
| `choice` | object `label → description`, 2–20 options | `choice`, `probabilities` (per label), `confidence` |
| `score` | list of level descriptions, lowest first, 2–20 | `score` (expected level index, 0…n−1), `level` (nearest label), `probabilities` (list), `confidence` |
| `yesno` | optional `{"yes": "...", "no": "..."}` | `probability` (P(yes)), `answer` (`probability ≥ 0.5`), `confidence` |

`confidence` is the highest probability. With `min_confidence`, every answer gets
`low_confidence: true|false`; answers are never withheld.

Errors: `401` bad/missing key · `422` malformed (body names the field) · `413` text > 8,000
chars, > 10 questions, > 20 options, or body > 64 KiB · `503` + `Retry-After` while the model
loads or when 4 requests are already waiting behind the running one.

### `GET /health`

Public. `200 {"status":"ok","model":"laya-multilingual"}` when ready, `503 {"status":"loading"}`
while the model loads (~65 s after a start).

## Using Laya well

Laya is a fast zero-shot base, not an oracle. From its own docs and our tests:

- Use semantic choice labels (`billing`, `technical`); never `yes`/`no`/`true`/`false` as
  choice keys — use a `yesno` question instead.
- Negations and conditional statements are weak spots: "Si no lo arregláis me doy de baja"
  scored P(threatens to leave) = 0.19 on our deployment. Validate questions on your own texts.
- Use `min_confidence` and route `low_confidence` answers to a human or a fallback.
- Latency grows ~linearly with the number of questions (no batching benefit on CPU).
- Keep `score` scales short: with 5 star levels an enthusiastic review came back
  "2 stars" (0.61); 3 levels (`mal`/`normal`/`bien`) or a `choice` got it right.
- Prefer concrete questions about the text: "¿necesita respuesta?" answered `false` (0.96)
  for an email asking a direct question; "¿Propone una fecha?" answered `true`. High
  confidence does not mean correct.

## Performance on void-server

Raspberry Pi 4B, laya 0.3.22, torch 2.14.1+cpu, 3 threads, model revision `55cf4c4e`:

| | |
|---|---|
| Model load (weights cached) | ~55–65 s |
| Resident memory | ~2.1 GB steady, ~2.6 GB peak |
| 1 question (warm) | ~1.1 s |
| 3 questions (warm) | ~2.3 s |
| Image size | 1.6 GB |

## Configuration (`.env`, git-ignored)

Copy `.env.example`. `ARGOS_API_KEYS` is `id:key,id:key` (one per client; generate with
`openssl rand -hex 32`; remove a pair + restart to revoke). The service refuses to start
without keys. `ARGOS_MODEL_REVISION` pins the Hugging Face commit; `ARGOS_THREADS`,
`ARGOS_MAX_QUEUE` tune CPU use and queueing.

**Memory limit caveat:** the host kernel boots with `cgroup_disable=memory`, so the
compose `mem_limit: 3g` is currently *not enforced* (Docker warns "No memory limit
support"). It takes effect once memory cgroups are enabled on the host (infra concern).

## Development

```bash
python3 -m venv .venv
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu   # CPU-only, avoids ~3 GB of CUDA
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest                                  # all fast tests (fake engine, no torch)
.venv/bin/python -m pytest tests/test_decide.py::test_over_limit_is_413   # one test
```

Real-model smoke test (inside the image; pytest is installed as root, tests run as `app`
so the shared weights volume keeps the right owner):

```bash
docker run --rm -u root --env-file .env -v $PWD/tests:/app/tests:ro -v $PWD/pytest.ini:/app/pytest.ini:ro \
  -v argos-api_argos-hf-cache:/data/hf argos-api:latest \
  sh -c 'pip install -q pytest~=8.3 pytest-asyncio~=0.24 httpx~=0.28 && su app -c "python -m pytest -m model -p no:cacheprovider"'
```

## Deploy (on void-server)

```bash
cd ~/argos/server
docker compose up -d --build
docker compose logs -f argos-api        # wait for "model laya-multilingual loaded"
curl -s https://argos.northernarchive.com/health
```
