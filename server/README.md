# argos-api

HTTP API over the [Laya](https://laya.convaiinnovations.com/) decision engine
(`laya-multilingual` checkpoint): send a text plus typed questions, get calibrated
answers. Public at `https://argos-api.northernarchive.com`. It moved there from
`argos.northernarchive.com` (now the web wizard), which answers `308` to the new host for
`/v1/*`, `/health`, `/docs`, `/redoc` and `/openapi.json`; `curl -L` drops `Authorization`
across hosts, so update the URL in scripts.

## API

All `/v1/*` endpoints need `Authorization: Bearer <key>` (keys in `.env`, see below).

- **Web wizard:** <https://argos.northernarchive.com> builds a request step by step (presets,
  custom questions or the [`examples/`](examples/)), sends it and shows the answer as bars
  plus the exact request/response JSON and a curl. Code and deploy: [`../web/`](../web/README.md).
- **API reference with request/response examples for every endpoint** (Spanish):
  [`API.md`](API.md).
- **Swagger UI:** <https://argos-api.northernarchive.com/docs> (**Authorize** → paste the key
  alone, without "Bearer" → *Try it out*); OpenAPI schema at `/openapi.json`. The bearer
  scheme is declared by `HTTPBearer(auto_error=False)` in `auth.py`; it does not change auth.
- **Postman:** import [`postman/argos.postman_collection.json`](postman/argos.postman_collection.json)
  and set the `apiKey` collection variable. It has `/health`, the [`examples/`](examples/)
  requests with expected-result tests, the presets, and 401/404/422/413 cases. Headless:
  `npx -y newman run postman/argos.postman_collection.json --env-var apiKey=$ARGOS_KEY`.
- **Quick-test guide for testers** (Spanish): [`TESTING.md`](TESTING.md).

### `POST /v1/decide`

```bash
curl -s https://argos-api.northernarchive.com/v1/decide \
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

### Presets

Ready-made Spanish question sets, so a caller only sends the text. Each preset has its own
endpoint, listed in Swagger with its questions and a dropdown for `questions`:
`POST /v1/presets/triage`, `/guard`, `/email`, `/moderation` and `/router`. `GET /v1/presets`
lists them with their questions in `/v1/decide` format (no inference; works while loading).
The generic `POST /v1/presets/{name}` still works (`404` for an unknown name) but is hidden
from Swagger. Request/response examples for every preset: [`API.md`](API.md#endpoints-de-presets).

```bash
curl -s https://argos-api.northernarchive.com/v1/presets/triage \
  -H "Authorization: Bearer $ARGOS_KEY" -H 'content-type: application/json' \
  -d '{"text": "Me habéis cobrado dos veces, quiero que me devolváis el dinero.", "min_confidence": 0.8}'
```

Body: `text`, optional `min_confidence`, optional `questions` (list of question names to
answer only those). A full preset takes 7–11 s on the Pi (6-option choices are the slow
part); a subset is much faster. Response: the `/v1/decide` response plus `"preset"`. Errors as
`/v1/decide`, plus `422` for a question name the preset does not have (`literal_error`
listing the valid names).

Measured accuracy per question (for maintainers; not a publication gate since
`publish-all-presets`), 2026-10-01, model revision `55cf4c4e`, 86 labelled Spanish texts in
`evals/presets.jsonl`. "Balanced" is the mean recall per expected answer, so a question that
always answers "no" scores 50 %:

| preset | question | accuracy | balanced | per expected answer |
|---|---|---|---|---|
| `triage` | `churn_risk` | 14/14 | 100% | False:11/11 · True:3/3 |
| `triage` | `frustration` | 5/16 | 29% | 0:1/6 · 1:0/3 · 2:4/4 · 3:0/3 |
| `triage` | `intent` | 13/14 | 83% | billing_question:3/3 · cancellation:2/2 · information:2/2 · other:0/1 · refund:3/3 · technical_help:3/3 |
| `triage` | `is_urgent` | 11/16 | 54% | False:10/12 · True:1/4 |
| `triage` | `refund_requested` | 13/16 | 88% | False:9/12 · True:4/4 |
| `guard` | `harm_severity` | 2/14 | 42% | 0:0/9 · 1:1/1 · 2:1/4 |
| `guard` | `jailbreak` | 16/18 | 93% | False:13/15 · True:3/3 |
| `guard` | `prompt_injection` | 17/19 | 94% | False:14/16 · True:3/3 |
| `guard` | `sensitive_data` | 17/21 | 89% | False:14/18 · True:3/3 |
| `guard` | `topic` | 4/10 | 42% | coding:2/2 · general_knowledge:1/2 · other:0/1 · personal_advice:0/1 · product_support:0/3 · security_testing:1/1 |
| `email` | `category` | 10/17 | 66% | billing:2/2 · hr:1/2 · other:1/5 · sales:1/2 · security:3/4 · technical:2/2 |
| `email` | `is_phishing` | 9/16 | 73% | False:6/13 · True:3/3 |
| `email` | `is_spam` | 9/14 | 65% | False:7/11 · True:2/3 |
| `email` | `needs_reply` | 9/14 | 65% | False:4/6 · True:5/8 |
| `email` | `urgency` | 4/12 | 50% | 0:0/7 · 1:1/2 · 2:3/3 |
| `moderation` | `harassment` | 10/15 | 53% | False:9/11 · True:1/4 |
| `moderation` | `severity` | 2/12 | 25% | 0:0/4 · 1:0/2 · 2:2/2 · 3:0/4 |
| `moderation` | `spam` | 10/15 | 67% | False:8/12 · True:2/3 |
| `moderation` | `threat` | 11/15 | 46% | False:11/12 · True:0/3 |
| `moderation` | `toxic` | 10/14 | 71% | False:7/7 · True:3/7 |
| `router` | `difficulty` | 5/11 | 42% | 0:1/3 · 1:2/3 · 2:2/3 · 3:0/2 |
| `router` | `domain` | 11/14 | 81% | chitchat:2/2 · code:2/3 · data_analysis:2/2 · factual_lookup:2/3 · math_or_logic:1/2 · writing:2/2 |
| `router` | `is_sensitive` | 13/16 | 50% | False:13/13 · True:0/3 |
| `router` | `needs_tools` | 13/16 | 50% | False:13/13 · True:0/3 |

Each question uses the better of two Spanish wordings tried (archived `add-decision-presets`
design, D8; choice in `publish-all-presets` design, D1). Samples are small (3–4 "yes" texts
per yes/no question).

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
- Latency grows ~linearly with the number of questions; batching texts (`decide_batch`)
  measured only 3–7 % faster per text on the Pi, so there is no batch endpoint.
- Scales with 3–4 levels mostly answer the middle level: in the preset evaluation no score
  question reached 45 %. Prefer `choice` or `yesno`.
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
`ARGOS_MAX_QUEUE` tune CPU use and queueing. `ARGOS_CORS_ORIGINS` (comma-separated, default
`https://argos-api.northernarchive.com`, empty disables) lists the browser origins allowed to
call the API cross-origin — the web wizard; it does not replace the API key.

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

Preset evaluation report (real model). Run it after changing `argos_api/presets.py`, upgrading
`laya` or changing `ARGOS_MODEL_REVISION`, and update the accuracy table above. It always exits
0 and marks questions under 80 % balanced accuracy; `--misses` lists the tuning texts each
question got wrong, and `--preset NAME` runs one preset:

```bash
docker run --rm --env-file .env -v $PWD/argos_api:/app/argos_api:ro -v $PWD/evals:/app/evals:ro \
  -v argos-api_argos-hf-cache:/data/hf argos-api:latest python evals/run_presets.py
```

It takes ~12 min. `tests/test_presets.py` checks that every label in `evals/presets.jsonl`
matches a published question and that coverage holds (≥ 10 texts per question, ≥ 3 yes and
≥ 3 no per yesno, every choice option at least once). Lines with `"holdout": true` are not
used for rewording; misses are only printed for the others.

## Deploy (on void-server)

```bash
cd ~/argos/server
docker compose up -d --build
docker compose logs -f argos-api        # wait for "model laya-multilingual loaded"
curl -s https://argos-api.northernarchive.com/health
```
