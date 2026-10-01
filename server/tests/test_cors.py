import httpx
import pytest

from argos_api.main import create_app

from .conftest import AUTH, FakeEngine, make_settings, triage_body

WIZARD = {"Origin": "https://argos.example.com"}


@pytest.fixture
async def client(engine):
    app = create_app(make_settings(argos_cors_origins=WIZARD["Origin"]), engine)
    async with app.router.lifespan_context(app):
        assert app.state.ready.wait(5)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


def allowed(response) -> bool:
    return response.headers.get("access-control-allow-origin") == WIZARD["Origin"]


async def test_preflight_from_wizard_needs_no_key(client, engine):
    r = await client.options(
        "/v1/decide",
        headers={
            **WIZARD,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization, content-type",
        },
    )
    assert r.status_code == 200
    assert allowed(r)
    assert "POST" in r.headers["access-control-allow-methods"]
    assert "authorization" in r.headers["access-control-allow-headers"].lower()
    assert "access-control-allow-credentials" not in r.headers
    assert engine.calls == []


async def test_success_carries_cors(client):
    r = await client.post("/v1/decide", json=triage_body(), headers={**AUTH, **WIZARD})
    assert r.status_code == 200
    assert allowed(r)
    assert "retry-after" in r.headers["access-control-expose-headers"].lower()


async def test_401_cross_origin(client):
    r = await client.post("/v1/presets/triage", json={"text": "hola"}, headers=WIZARD)
    assert r.status_code == 401
    assert allowed(r)


async def test_422_cross_origin(client):
    r = await client.post("/v1/decide", json={"text": ""}, headers={**AUTH, **WIZARD})
    assert r.status_code == 422
    assert allowed(r)


async def test_413_from_body_guard_cross_origin(client):
    r = await client.post(
        "/v1/decide", content=b"x" * (64 * 1024 + 1), headers={**AUTH, **WIZARD, "content-type": "application/json"}
    )
    assert r.status_code == 413
    assert allowed(r)


async def test_503_exposes_retry_after():
    engine = FakeEngine(load_blocks=True)
    app = create_app(make_settings(argos_cors_origins=WIZARD["Origin"]), engine)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post("/v1/decide", json=triage_body(), headers={**AUTH, **WIZARD})
        engine.release_load.set()
    assert r.status_code == 503
    assert r.headers["retry-after"] == "5"
    assert allowed(r)
    assert "retry-after" in r.headers["access-control-expose-headers"].lower()


@pytest.mark.parametrize("origin", ["https://evil.example", "http://argos.example.com"])
async def test_unlisted_origin_gets_no_cors(client, origin):
    r = await client.get("/health", headers={"Origin": origin})
    assert "access-control-allow-origin" not in r.headers


async def test_cors_off_by_default(engine):
    app = create_app(make_settings(), engine)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.get("/health", headers=WIZARD)
    assert "access-control-allow-origin" not in r.headers
