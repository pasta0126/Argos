import logging
import os
import threading
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from .auth import require_api_key
from .config import Settings
from .engine import DecisionEngine
from .gate import Busy, InferenceGate
from .schemas import DecideRequest, DecideResponse, limit_violation

log = logging.getLogger("argos")

# Generous cap on the raw body: 8,000 chars of text (up to 4 bytes each in
# UTF-8) plus questions. Rejects oversized uploads before JSON parsing.
MAX_BODY_BYTES = 64 * 1024
RETRY_AFTER_S = "5"


def _unavailable(status: str) -> JSONResponse:
    return JSONResponse({"status": status}, status_code=503, headers={"Retry-After": RETRY_AFTER_S})


def create_app(settings: Settings | None = None, engine: DecisionEngine | None = None) -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = settings or Settings()  # type: ignore[call-arg]  # fails fast without keys
    if engine is None:
        from .laya_engine import LayaEngine  # imports torch; keep it out of tests

        engine = LayaEngine(revision=settings.argos_model_revision, threads=settings.argos_threads)

    ready = threading.Event()

    def load_model() -> None:
        started = time.monotonic()
        try:
            engine.load()
        except Exception:
            log.exception("model load failed; exiting so the container restarts")
            os._exit(1)
        ready.set()
        log.info("model %s loaded in %.1fs", engine.model_name, time.monotonic() - started)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Load in the background so /health can answer "loading" meanwhile.
        threading.Thread(target=load_model, name="model-load", daemon=True).start()
        yield

    app = FastAPI(title="argos-api", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine
    app.state.ready = ready
    app.state.gate = InferenceGate(settings.argos_max_queue)

    @app.middleware("http")
    async def guard_and_log(request: Request, call_next):
        started = time.monotonic()
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
            response = JSONResponse({"detail": "request body too large"}, status_code=413)
        else:
            response = await call_next(request)
        # Metadata only: never the text, instructions or criteria.
        log.info(
            "%s %s %d %dms questions=%s client=%s",
            request.method,
            request.url.path,
            response.status_code,
            (time.monotonic() - started) * 1000,
            getattr(request.state, "question_count", "-"),
            getattr(request.state, "client_id", "-"),
        )
        return response

    @app.get("/health")
    async def health():
        if not ready.is_set():
            return _unavailable("loading")
        return {"status": "ok", "model": engine.model_name}

    @app.post("/v1/decide", response_model=DecideResponse)
    async def decide(body: DecideRequest, request: Request, _client: str = Depends(require_api_key)):
        request.state.question_count = len(body.questions)
        if (reason := limit_violation(body)) is not None:
            return JSONResponse({"detail": reason}, status_code=413)
        if not ready.is_set():
            return _unavailable("loading")
        try:
            async with app.state.gate:
                started = time.monotonic()
                answers = await run_in_threadpool(engine.decide, body.text, body.questions, body.min_confidence)
                latency_ms = round((time.monotonic() - started) * 1000)
        except Busy:
            return _unavailable("busy")
        return DecideResponse(answers=answers, model=engine.model_name, latency_ms=latency_ms)

    return app
