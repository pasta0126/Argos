import httpx

from argos_api.main import create_app

from .conftest import AUTH, FakeEngine, make_settings, triage_body


async def test_ready_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "model": "fake"}


async def test_loading_state_then_ready():
    engine = FakeEngine(load_blocks=True)
    app = create_app(make_settings(), engine)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
            health = await c.get("/health")
            assert health.status_code == 503
            assert health.json() == {"status": "loading"}

            decide = await c.post("/v1/decide", json=triage_body(), headers=AUTH)
            assert decide.status_code == 503
            assert decide.headers["retry-after"]
            assert engine.calls == []

            engine.release_load.set()
            assert app.state.ready.wait(5)
            assert (await c.get("/health")).status_code == 200
