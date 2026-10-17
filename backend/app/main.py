"""
Aplicacion FastAPI: lifespan, CORS, manejo de errores y /health.

Los endpoints son sincronos (`def`) a proposito: los embeddings y Ollama
bloquean, y asi FastAPI los corre en su threadpool sin frenar el resto.
Todos los routers exigen `usuario_actual`; la unica ruta publica es /health.

Se arranca en desarrollo con:
    uv run uvicorn app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager

import psycopg
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.auth import usuario_actual
from app.core.config import settings
from app.db.connection import init_db
from app.schemas import Salud

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if settings.preload_embeddings:
        from app.services.embeddings import embed_query

        embed_query("precarga")  # carga el modelo para que la primera pregunta no espere
    yield


app = FastAPI(
    title="Agente DC Comics",
    description="Agente RAG sobre el universo DC Comics.",
    lifespan=lifespan,
    swagger_ui_init_oauth={
        "clientId": settings.keycloak_client_id,
        "usePkceWithAuthorizationCodeGrant": True,
    },
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.lista_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(psycopg.OperationalError)
def base_no_responde(request: Request, exc: psycopg.OperationalError):
    return JSONResponse(
        status_code=503, content={"detail": "La base de datos no responde."}
    )


@app.get("/health", response_model=Salud)
def health():
    return Salud()


# Todos los routers pasan por usuario_actual (401 sin token); /health queda fuera
PROTEGIDO = [Depends(usuario_actual)]
