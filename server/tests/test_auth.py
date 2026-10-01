import httpx
import pytest

from argos_api.main import create_app

from .conftest import AUTH, make_settings, triage_body


async def test_missing_header_is_401(client, engine):
    r = await client.post("/v1/decide", json=triage_body())
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == "Bearer"
    assert engine.calls == []


@pytest.mark.parametrize("header", ["Bearer wrong", "Basic kaizen-key-0123456789", "Bearer", "kaizen-key-0123456789"])
async def test_wrong_key_is_401(client, engine, header):
    r = await client.post("/v1/decide", json=triage_body(), headers={"Authorization": header})
    assert r.status_code == 401
    assert engine.calls == []


async def test_unauthenticated_malformed_body_is_401_not_422(client):
    r = await client.post("/v1/decide", json={"nope": 1})
    assert r.status_code == 401


@pytest.mark.parametrize("key", ["kaizen-key-0123456789", "cli-key-0123456789"])
async def test_each_configured_key_works(client, key):
    r = await client.post("/v1/decide", json=triage_body(), headers={"Authorization": f"Bearer {key}"})
    assert r.status_code == 200


async def test_health_needs_no_key(client):
    r = await client.get("/health")
    assert r.status_code == 200


async def test_removed_key_is_revoked_others_still_work(engine):
    app = create_app(make_settings(argos_api_keys="cli:cli-key-0123456789"), engine)
    async with app.router.lifespan_context(app):
        assert app.state.ready.wait(5)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
            revoked = await c.post("/v1/decide", json=triage_body(), headers=AUTH)
            other = await c.post("/v1/decide", json=triage_body(), headers={"Authorization": "Bearer cli-key-0123456789"})
    assert revoked.status_code == 401
    assert other.status_code == 200


async def test_openapi_declares_bearer_scheme_on_v1_only(client):
    schema = (await client.get("/openapi.json")).json()
    schemes = schema["components"]["securitySchemes"]
    assert any(s["type"] == "http" and s["scheme"] == "bearer" for s in schemes.values())
    name = next(iter(schemes))
    for path, ops in schema["paths"].items():
        for op in ops.values():
            if path.startswith("/v1/"):
                assert {name: []} in op.get("security", []), path
            else:
                assert "security" not in op, path
