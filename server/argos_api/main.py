import logging
import os
import threading
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .auth import require_api_key
from .config import Settings
from .engine import DecisionEngine
from .gate import Busy, InferenceGate
from . import oracle
from .presets import PRESETS
from .presets import Preset
from .schemas import (
    DecideRequest,
    DecideResponse,
    EightBallResponse,
    MAX_QUESTION_CHARS,
    OracleRequest,
    PresetRequest,
    PresetResponse,
    limit_violation,
    YesNoOracleResponse,
    preset_request_model,
)

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
            "%s %s %d %dms questions=%s client=%s preset=%s",
            request.method,
            request.url.path,
            response.status_code,
            (time.monotonic() - started) * 1000,
            getattr(request.state, "question_count", "-"),
            getattr(request.state, "client_id", "-"),
            getattr(request.state, "preset", "-"),
        )
        return response

    # Added last so it wraps everything: 413s from the guard above, 401s and 503s must carry
    # CORS headers too, or the browser hides them from the wizard as network errors.
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["GET", "POST"],
            allow_headers=["Authorization", "Content-Type"],
            expose_headers=["Retry-After"],
            allow_credentials=False,
            max_age=600,
        )
    log.info("CORS origins: %s", ", ".join(settings.cors_origins) or "none")

    @app.get("/health")
    async def health():
        if not ready.is_set():
            return _unavailable("loading")
        return {"status": "ok", "model": engine.model_name}

    async def run_decision(body: DecideRequest, request: Request) -> DecideResponse | JSONResponse:
        """The decision pipeline shared by /v1/decide and the presets: limits, readiness, gate, engine."""
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

    @app.post("/v1/decide", response_model=DecideResponse)
    async def decide(body: DecideRequest, request: Request, _client: str = Depends(require_api_key)):
        return await run_decision(body, request)

    @app.get("/v1/presets")
    async def list_presets(_client: str = Depends(require_api_key)):
        # Static: answers while the model loads. Questions in the format /v1/decide accepts.
        return {
            "presets": {
                name: {
                    "description": preset.description,
                    "questions": {q: question.model_dump(exclude_none=True) for q, question in preset.questions.items()},
                }
                for name, preset in PRESETS.items()
            }
        }

    async def answer_preset(name: str, preset: Preset, body: PresetRequest, request: Request):
        request.state.preset = name
        questions = preset.questions
        if body.questions is not None:
            questions = {q: questions[q] for q in body.questions}
        result = await run_decision(
            DecideRequest(text=body.text, questions=questions, min_confidence=body.min_confidence), request
        )
        if isinstance(result, JSONResponse):
            return result
        return PresetResponse(preset=name, **result.model_dump())

    def preset_endpoint(name: str, preset: Preset):
        body_model = preset_request_model(name, list(preset.questions), preset.example)

        async def endpoint(body: body_model, request: Request, _client: str = Depends(require_api_key)):  # type: ignore[valid-type]
            return await answer_preset(name, preset, body, request)

        return endpoint

    # One documented route per preset, registered before the generic route so they match first.
    for name, preset in PRESETS.items():
        questions_doc = "\n".join(
            f"- `{q}` ({question.type}): {question.instructions}"
            + (f" Opciones: {', '.join(f'`{o}`' for o in question.criteria)}." if question.type == "choice" else "")
            for q, question in preset.questions.items()
        )
        app.add_api_route(
            f"/v1/presets/{name}",
            preset_endpoint(name, preset),
            methods=["POST"],
            response_model=PresetResponse,
            summary=f"Preset {name}",
            description=f"{preset.description}\n\n**Preguntas:**\n\n{questions_doc}\n\n"
            "`questions` permite responder solo algunas; sin él se responden todas.",
            tags=["presets"],
        )

    # Kept for clients that build the URL from a variable; Swagger lists the per-preset routes instead.
    @app.post("/v1/presets/{name}", response_model=PresetResponse, include_in_schema=False)
    async def run_preset(name: str, body: PresetRequest, request: Request, _client: str = Depends(require_api_key)):
        if (preset := PRESETS.get(name)) is None:
            raise HTTPException(status_code=404, detail=f"unknown preset {name!r}")
        if body.questions is not None:
            unknown = [(i, q) for i, q in enumerate(body.questions) if q not in preset.questions]
            if unknown:
                raise HTTPException(
                    status_code=422,
                    detail=[
                        {"loc": ["body", "questions", i], "msg": f"preset {name!r} has no question {q!r}", "type": "value_error"}
                        for i, q in unknown
                    ],
                )
        return await answer_preset(name, preset, body, request)

    async def ask_oracle(body: OracleRequest, question, request: Request) -> dict | JSONResponse:
        """Run one fixed oracle question with the caller's question as the text; no threshold."""
        request.state.question_count = 1
        if len(body.question) > MAX_QUESTION_CHARS:
            return JSONResponse({"detail": f"question exceeds {MAX_QUESTION_CHARS} characters"}, status_code=413)
        result = await run_decision(
            DecideRequest(text=body.question, questions={oracle.QUESTION_NAME: question}, min_confidence=None), request
        )
        if isinstance(result, JSONResponse):
            return result
        return {"answer": result.answers[oracle.QUESTION_NAME], "model": result.model, "latency_ms": result.latency_ms}

    @app.post(
        "/v1/oracle/yesno",
        response_model=YesNoOracleResponse,
        summary="Oráculo sí/no",
        description="Responde sí o no a una pregunta. Solo se envía `question` (hasta 500 caracteres); "
        "la instrucción es fija y no hay umbral de confianza.\n\n"
        "Responde a cualquier pregunta: haz preguntas que se contesten con sí o no, porque una "
        "pregunta abierta también recibe un sí o un no.",
        tags=["oracle"],
    )
    async def oracle_yesno(body: OracleRequest, request: Request, _client: str = Depends(require_api_key)):
        result = await ask_oracle(body, oracle.YESNO_QUESTION, request)
        if isinstance(result, JSONResponse):
            return result
        return YesNoOracleResponse(
            **oracle.yesno_answer(result["answer"]), model=result["model"], latency_ms=result["latency_ms"]
        )

    @app.post(
        "/v1/oracle/8ball",
        response_model=EightBallResponse,
        summary="Bola 8 mágica",
        description="Responde con una de las 20 frases clásicas de la bola 8 mágica. Solo se envía "
        "`question` (hasta 500 caracteres). Devuelve la frase ganadora (la más probable), el "
        "porcentaje de cada frase (suman 100) y los totales afirmativo, neutro y negativo.",
        tags=["oracle"],
    )
    async def oracle_8ball(body: OracleRequest, request: Request, _client: str = Depends(require_api_key)):
        result = await ask_oracle(body, oracle.EIGHTBALL_QUESTION, request)
        if isinstance(result, JSONResponse):
            return result
        return EightBallResponse(
            **oracle.eightball_answer(result["answer"]), model=result["model"], latency_ms=result["latency_ms"]
        )

    return app
