import asyncio
import logging

import pytest

from argos_api.schemas import MAX_OPTIONS, MAX_QUESTIONS, MAX_TEXT_CHARS

from .conftest import AUTH, triage_body


async def test_multiple_questions_in_one_call(client, engine):
    r = await client.post("/v1/decide", json=triage_body(), headers=AUTH)
    assert r.status_code == 200
    data = r.json()
    assert set(data["answers"]) == {"department", "refund"}
    assert data["model"] == "fake"
    assert isinstance(data["latency_ms"], int)
    assert len(engine.calls) == 1


async def test_min_confidence_is_passed_through(client, engine):
    r = await client.post("/v1/decide", json=triage_body(min_confidence=0.8), headers=AUTH)
    assert r.status_code == 200
    answers = r.json()["answers"]
    assert answers["department"]["low_confidence"] is True
    assert answers["refund"]["low_confidence"] is False
    assert engine.calls[0][2] == 0.8


async def test_no_low_confidence_field_without_threshold(client):
    r = await client.post("/v1/decide", json=triage_body(), headers=AUTH)
    assert all("low_confidence" not in a for a in r.json()["answers"].values())


@pytest.mark.parametrize(
    "mutate, loc_part",
    [
        (lambda b: b.update(text=""), "text"),
        (lambda b: b.pop("text"), "text"),
        (lambda b: b.update(questions={}), "questions"),
        (lambda b: b["questions"]["department"].update(type="ranking"), "department"),
        (lambda b: b["questions"]["department"].pop("instructions"), "department"),
        (lambda b: b["questions"]["department"].update(criteria={"only": "one"}), "department"),
        (lambda b: b["questions"]["department"].update(criteria=["a", "b"]), "department"),
        (lambda b: b["questions"]["refund"].update(criteria={"si": "x", "no": "y"}), "refund"),
        (lambda b: b.update(min_confidence=1.5), "min_confidence"),
        (lambda b: b.update(extra="field"), "extra"),
    ],
)
async def test_malformed_request_is_422_naming_the_field(client, engine, mutate, loc_part):
    body = triage_body()
    mutate(body)
    r = await client.post("/v1/decide", json=body, headers=AUTH)
    assert r.status_code == 422
    locs = [".".join(map(str, e["loc"])) for e in r.json()["detail"]]
    assert any(loc_part in loc for loc in locs), locs
    assert engine.calls == []


async def test_score_question_accepted(client):
    body = triage_body()
    body["questions"] = {"urgency": {"type": "score", "instructions": "¿Urgencia?", "criteria": ["baja", "media", "alta"]}}
    r = await client.post("/v1/decide", json=body, headers=AUTH)
    assert r.status_code == 200
    assert r.json()["answers"]["urgency"]["level"] == "media"


@pytest.mark.parametrize(
    "mutate",
    [
        lambda b: b.update(text="x" * (MAX_TEXT_CHARS + 1)),
        lambda b: b.update(questions={f"q{i}": {"type": "yesno", "instructions": "?"} for i in range(MAX_QUESTIONS + 1)}),
        lambda b: b["questions"]["department"].update(criteria={f"o{i}": "d" for i in range(MAX_OPTIONS + 1)}),
    ],
    ids=["text", "questions", "options"],
)
async def test_over_limit_is_413(client, engine, mutate):
    body = triage_body()
    mutate(body)
    r = await client.post("/v1/decide", json=body, headers=AUTH)
    assert r.status_code == 413
    assert engine.calls == []


async def test_limits_are_inclusive(client):
    body = triage_body(text="x" * MAX_TEXT_CHARS)
    r = await client.post("/v1/decide", json=body, headers=AUTH)
    assert r.status_code == 200


async def test_huge_body_rejected_before_parsing(client, engine):
    r = await client.post("/v1/decide", content=b"{" + b" " * 70_000 + b"}", headers={**AUTH, "content-type": "application/json"})
    assert r.status_code == 413
    assert engine.calls == []


async def test_waiting_request_is_served_and_full_queue_gets_503(client, engine):
    # Default ARGOS_MAX_QUEUE is 4: one running + four waiting, the sixth is rejected.
    engine.release_decide.clear()
    running = asyncio.create_task(client.post("/v1/decide", json=triage_body(), headers=AUTH))
    await asyncio.to_thread(engine.decide_started.wait, 5)
    waiting = [asyncio.create_task(client.post("/v1/decide", json=triage_body(), headers=AUTH)) for _ in range(4)]
    await asyncio.sleep(0.1)

    rejected = await client.post("/v1/decide", json=triage_body(), headers=AUTH)
    assert rejected.status_code == 503
    assert rejected.headers["retry-after"]

    engine.release_decide.set()
    results = await asyncio.gather(running, *waiting)
    assert [r.status_code for r in results] == [200] * 5


async def test_logs_contain_metadata_but_not_text(client, caplog):
    caplog.set_level(logging.INFO, logger="argos")
    secret = "Mi número de tarjeta es 4111 y quiero un reembolso"
    body = triage_body(text=secret)
    r = await client.post("/v1/decide", json=body, headers=AUTH)
    assert r.status_code == 200
    logged = "\n".join(rec.getMessage() for rec in caplog.records)
    assert "/v1/decide 200" in logged
    assert "client=kaizen" in logged
    assert "questions=2" in logged
    assert secret not in logged
    assert "¿Qué departamento?" not in logged and "pagos" not in logged
