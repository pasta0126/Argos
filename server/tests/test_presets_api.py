import asyncio
import logging

import httpx
import pytest

from argos_api.main import create_app
from argos_api.presets import PRESETS
from argos_api.schemas import MAX_TEXT_CHARS

from .conftest import AUTH, FakeEngine, make_settings

TEXT = "Me habéis cobrado dos veces, quiero que me devolváis el dinero"


async def test_list_presets(client, engine):
    r = await client.get("/v1/presets", headers=AUTH)
    assert r.status_code == 200
    presets = r.json()["presets"]
    assert set(presets) == set(PRESETS)
    for name, p in presets.items():
        assert p["description"]
        assert set(p["questions"]) == set(PRESETS[name].questions)
    assert engine.calls == []


@pytest.mark.parametrize("name", sorted(PRESETS))
async def test_listed_questions_are_accepted_by_decide(client, name):
    questions = (await client.get("/v1/presets", headers=AUTH)).json()["presets"][name]["questions"]
    r = await client.post("/v1/decide", json={"text": TEXT, "questions": questions}, headers=AUTH)
    assert r.status_code == 200, r.json()


async def test_list_presets_needs_key(client):
    assert (await client.get("/v1/presets")).status_code == 401


async def test_run_full_preset(client, engine):
    r = await client.post("/v1/presets/triage", json={"text": TEXT}, headers=AUTH)
    assert r.status_code == 200
    data = r.json()
    assert data["preset"] == "triage"
    assert set(data["answers"]) == set(PRESETS["triage"].questions)
    assert data["model"] == "fake" and isinstance(data["latency_ms"], int)
    assert engine.calls[0][0] == TEXT


async def test_min_confidence_flags_every_answer(client):
    r = await client.post("/v1/presets/triage", json={"text": TEXT, "min_confidence": 0.99}, headers=AUTH)
    answers = r.json()["answers"]
    assert answers and all(a["low_confidence"] is True for a in answers.values())


async def test_question_subset(client, engine):
    name, question = "triage", next(iter(PRESETS["triage"].questions))
    r = await client.post(f"/v1/presets/{name}", json={"text": TEXT, "questions": [question]}, headers=AUTH)
    assert r.status_code == 200
    assert list(r.json()["answers"]) == [question]
    assert list(engine.calls[0][1]) == [question]


async def test_unknown_question_in_subset_is_422(client, engine):
    r = await client.post("/v1/presets/triage", json={"text": TEXT, "questions": ["horoscope"]}, headers=AUTH)
    assert r.status_code == 422
    assert "horoscope" in str(r.json()["detail"])
    assert engine.calls == []


async def test_unknown_preset_is_404(client, engine):
    r = await client.post("/v1/presets/horoscope", json={"text": TEXT}, headers=AUTH)
    assert r.status_code == 404
    assert "horoscope" in r.json()["detail"]
    assert engine.calls == []


@pytest.mark.parametrize(
    "body, loc_part",
    [
        ({"text": ""}, "text"),
        ({}, "text"),
        ({"text": TEXT, "questions": []}, "questions"),
        ({"text": TEXT, "min_confidence": 2}, "min_confidence"),
        ({"text": TEXT, "extra": 1}, "extra"),
    ],
)
async def test_malformed_body_is_422(client, engine, body, loc_part):
    r = await client.post("/v1/presets/triage", json=body, headers=AUTH)
    assert r.status_code == 422
    locs = [".".join(map(str, e["loc"])) for e in r.json()["detail"]]
    assert any(loc_part in loc for loc in locs), locs
    assert engine.calls == []


async def test_long_text_is_413(client, engine):
    r = await client.post("/v1/presets/triage", json={"text": "x" * (MAX_TEXT_CHARS + 1)}, headers=AUTH)
    assert r.status_code == 413
    assert engine.calls == []


async def test_run_preset_needs_key(client, engine):
    assert (await client.post("/v1/presets/triage", json={"text": TEXT})).status_code == 401
    assert engine.calls == []


async def test_loading_list_works_run_is_503():
    engine = FakeEngine(load_blocks=True)
    app = create_app(make_settings(), engine)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
            assert (await c.get("/v1/presets", headers=AUTH)).status_code == 200
            r = await c.post("/v1/presets/triage", json={"text": TEXT}, headers=AUTH)
            assert r.status_code == 503 and r.headers["retry-after"]
            assert engine.calls == []
            engine.release_load.set()


async def test_shares_the_inference_queue_with_decide(client, engine):
    # One running + ARGOS_MAX_QUEUE (4) waiting; the next preset call is rejected.
    engine.release_decide.clear()
    body = {"text": TEXT, "questions": [next(iter(PRESETS["triage"].questions))]}
    running = asyncio.create_task(client.post("/v1/presets/triage", json=body, headers=AUTH))
    await asyncio.to_thread(engine.decide_started.wait, 5)
    waiting = [asyncio.create_task(client.post("/v1/presets/triage", json=body, headers=AUTH)) for _ in range(4)]
    await asyncio.sleep(0.1)
    rejected = await client.post("/v1/presets/triage", json=body, headers=AUTH)
    assert rejected.status_code == 503 and rejected.headers["retry-after"]
    engine.release_decide.set()
    assert [r.status_code for r in await asyncio.gather(running, *waiting)] == [200] * 5


async def test_logs_preset_name_but_not_text(client, caplog):
    caplog.set_level(logging.INFO, logger="argos")
    secret = "Mi número de tarjeta es 4111 y quiero un reembolso"
    r = await client.post("/v1/presets/triage", json={"text": secret}, headers=AUTH)
    assert r.status_code == 200
    logged = "\n".join(rec.getMessage() for rec in caplog.records)
    assert "/v1/presets/triage 200" in logged
    assert "preset=triage" in logged
    assert f"questions={len(PRESETS['triage'].questions)}" in logged
    assert secret not in logged


async def test_openapi_lists_one_operation_per_preset_and_hides_generic(client):
    paths = (await client.get("/openapi.json")).json()["paths"]
    for name in PRESETS:
        assert "post" in paths[f"/v1/presets/{name}"], name
    assert "/v1/presets/{name}" not in paths


async def test_openapi_subset_field_lists_the_preset_questions(client):
    schema = (await client.get("/openapi.json")).json()
    ref = schema["paths"]["/v1/presets/guard"]["post"]["requestBody"]["content"]["application/json"]["schema"]["$ref"]
    model = schema["components"]["schemas"][ref.rsplit("/", 1)[1]]
    array = next(s for s in model["properties"]["questions"]["anyOf"] if s.get("type") == "array")
    assert set(array["items"]["enum"]) == set(PRESETS["guard"].questions)
    assert model["examples"][0]["text"] == PRESETS["guard"].example


async def test_per_preset_route_runs_the_preset(client, engine):
    r = await client.post("/v1/presets/guard", json={"text": TEXT}, headers=AUTH)
    assert r.status_code == 200
    assert r.json()["preset"] == "guard"
    assert set(r.json()["answers"]) == set(PRESETS["guard"].questions)


async def test_per_preset_unknown_question_is_422_naming_it(client, engine):
    r = await client.post("/v1/presets/triage", json={"text": TEXT, "questions": ["mood"]}, headers=AUTH)
    assert r.status_code == 422
    errors = r.json()["detail"]
    assert any(e["loc"][:2] == ["body", "questions"] and e["input"] == "mood" for e in errors), errors
    assert engine.calls == []


async def test_per_preset_route_logs_preset_without_text(client, caplog):
    caplog.set_level(logging.INFO, logger="argos")
    secret = "Mi contraseña es hunter2"
    assert (await client.post("/v1/presets/guard", json={"text": secret}, headers=AUTH)).status_code == 200
    logged = "\n".join(rec.getMessage() for rec in caplog.records)
    assert "preset=guard" in logged and secret not in logged


ALL_PRESETS = {"triage", "guard", "email", "moderation", "router"}


async def test_all_five_presets_published(client):
    assert set((await client.get("/v1/presets", headers=AUTH)).json()["presets"]) == ALL_PRESETS
    paths = (await client.get("/openapi.json")).json()["paths"]
    assert {p.rsplit("/", 1)[1] for p in paths if p.startswith("/v1/presets/")} == ALL_PRESETS


async def test_triage_answers_all_five_questions(client):
    r = await client.post("/v1/presets/triage", json={"text": TEXT}, headers=AUTH)
    assert set(r.json()["answers"]) == {"intent", "is_urgent", "frustration", "refund_requested", "churn_risk"}
