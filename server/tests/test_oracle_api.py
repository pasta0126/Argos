import asyncio
import logging

import httpx
import pytest

from argos_api.main import create_app
from argos_api.oracle import EIGHTBALL_QUESTION, PHRASES, QUESTION_NAME, YESNO_QUESTION
from argos_api.schemas import MAX_QUESTION_CHARS

from .conftest import AUTH, FakeEngine, make_settings

QUESTION = "¿Me saldrá bien el examen?"
ORACLES = ["yesno", "8ball"]


async def test_yesno_shape(client, engine):
    r = await client.post("/v1/oracle/yesno", json={"question": QUESTION}, headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"answer", "probability", "confidence", "model", "latency_ms"}
    assert body["answer"] is True and body["probability"] == 0.9
    assert body["answer"] == (body["probability"] >= 0.5)
    assert body["model"] == "fake" and isinstance(body["latency_ms"], int)
    assert engine.calls == [(QUESTION, {QUESTION_NAME: YESNO_QUESTION}, None)]


async def test_8ball_shape(client, engine):
    r = await client.post("/v1/oracle/8ball", json={"question": QUESTION}, headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"answer", "kind", "phrases", "totals", "model", "latency_ms"}
    # FakeEngine peaks at level 1.
    assert body["answer"] == PHRASES[1][0] and body["kind"] == "negative"
    assert [(p["phrase"], p["kind"]) for p in body["phrases"]] == PHRASES
    assert round(sum(p["percentage"] for p in body["phrases"]) * 10) == 1000
    assert set(body["totals"]) == {"affirmative", "non_committal", "negative"}
    assert engine.calls == [(QUESTION, {QUESTION_NAME: EIGHTBALL_QUESTION}, None)]


@pytest.mark.parametrize("name", ORACLES)
async def test_open_question_still_answered(client, name):
    r = await client.post(f"/v1/oracle/{name}", json={"question": "¿Qué color de coche me compro?"}, headers=AUTH)
    assert r.status_code == 200
    assert "low_confidence" not in r.json()


@pytest.mark.parametrize("name", ORACLES)
@pytest.mark.parametrize(
    "body, loc_part",
    [
        ({"question": QUESTION, "min_confidence": 0.8}, "min_confidence"),
        ({"question": QUESTION, "text": "x"}, "text"),
        ({"question": QUESTION, "instructions": "x"}, "instructions"),
        ({"question": ""}, "question"),
        ({}, "question"),
    ],
)
async def test_malformed_is_422_naming_the_field(client, engine, name, body, loc_part):
    r = await client.post(f"/v1/oracle/{name}", json=body, headers=AUTH)
    assert r.status_code == 422
    locs = [".".join(map(str, e["loc"])) for e in r.json()["detail"]]
    assert any(loc_part in loc for loc in locs), locs
    assert engine.calls == []


@pytest.mark.parametrize("name", ORACLES)
async def test_question_limit(client, engine, name):
    r = await client.post(f"/v1/oracle/{name}", json={"question": "x" * (MAX_QUESTION_CHARS + 1)}, headers=AUTH)
    assert r.status_code == 413
    assert engine.calls == []
    r = await client.post(f"/v1/oracle/{name}", json={"question": "x" * MAX_QUESTION_CHARS}, headers=AUTH)
    assert r.status_code == 200


@pytest.mark.parametrize("name", ORACLES)
async def test_needs_key(client, engine, name):
    assert (await client.post(f"/v1/oracle/{name}", json={"question": QUESTION})).status_code == 401
    assert engine.calls == []


@pytest.mark.parametrize("name", ORACLES)
async def test_loading_is_503(name):
    engine = FakeEngine(load_blocks=True)
    app = create_app(make_settings(), engine)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(f"/v1/oracle/{name}", json={"question": QUESTION}, headers=AUTH)
            assert r.status_code == 503 and r.headers["retry-after"]
            assert engine.calls == []
            engine.release_load.set()


async def test_shares_the_inference_queue(client, engine):
    # One running + ARGOS_MAX_QUEUE (4) waiting; the next oracle call is rejected.
    engine.release_decide.clear()
    body = {"question": QUESTION}
    running = asyncio.create_task(client.post("/v1/oracle/8ball", json=body, headers=AUTH))
    await asyncio.to_thread(engine.decide_started.wait, 5)
    waiting = [asyncio.create_task(client.post("/v1/oracle/yesno", json=body, headers=AUTH)) for _ in range(4)]
    await asyncio.sleep(0.1)
    rejected = await client.post("/v1/oracle/yesno", json=body, headers=AUTH)
    assert rejected.status_code == 503 and rejected.headers["retry-after"]
    engine.release_decide.set()
    assert [r.status_code for r in await asyncio.gather(running, *waiting)] == [200] * 5


async def test_in_openapi_not_in_presets(client):
    paths = (await client.get("/openapi.json")).json()["paths"]
    for name in ORACLES:
        op = paths[f"/v1/oracle/{name}"]["post"]
        assert op["tags"] == ["oracle"]
    presets = (await client.get("/v1/presets", headers=AUTH)).json()["presets"]
    assert not any("oracle" in name or name in ORACLES for name in presets)


@pytest.mark.parametrize("name", ORACLES)
async def test_logs_metadata_but_not_question(client, caplog, name):
    caplog.set_level(logging.INFO, logger="argos")
    secret = "¿Me dejará mi pareja si le cuento lo de 4111?"
    r = await client.post(f"/v1/oracle/{name}", json={"question": secret}, headers=AUTH)
    assert r.status_code == 200
    logged = "\n".join(rec.getMessage() for rec in caplog.records)
    assert f"/v1/oracle/{name} 200" in logged
    assert "questions=1" in logged and "client=kaizen" in logged
    assert secret not in logged
