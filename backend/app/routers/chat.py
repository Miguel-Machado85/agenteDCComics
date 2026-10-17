"""
Endpoints de conversacion: POST /chat y GET /history.

Por cada pregunta se arma el grafo con la conexion de la request. Si Ollama
no responde se contesta 503 con un mensaje claro.
"""

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.agent.grafo import construir_grafo
from app.agent.llm import crear_llm
from app.agent.nodos import Dependencias
from app.core.auth import Usuario, usuario_actual
from app.core.config import settings
from app.db.connection import obtener_conexion
from app.schemas import EntradaHistorial, PreguntaIn, RespuestaChat
from app.services import historial
from app.services.retrieval import buscar

router = APIRouter(tags=["chat"])

UsuarioActual = Annotated[Usuario, Depends(usuario_actual)]
Conexion = Annotated[object, Depends(obtener_conexion)]


def obtener_grafo(conn: Conexion):
    """Dependencia sobrescribible en los tests por un grafo falso."""

    def guardar(estado) -> int:
        return historial.guardar(
            conn,
            estado["usuario_sub"],
            estado.get("username"),
            estado["pregunta"],
            estado["respuesta"],
            estado.get("rechazada", False),
            estado.get("intencion"),
            estado.get("fuentes", []),
        )

    return construir_grafo(
        Dependencias(
            llm=crear_llm(),
            llm_json=crear_llm(modo_json=True),
            buscar=lambda consulta, k: buscar(conn, consulta, k),
            guardar=guardar,
        )
    )


@router.post("/chat", response_model=RespuestaChat)
def chat(
    entrada: PreguntaIn,
    usuario: UsuarioActual,
    conn: Conexion,
    grafo: Annotated[object, Depends(obtener_grafo)],
):
    estado = {
        "pregunta": entrada.pregunta.strip(),
        "usuario_sub": usuario.sub,
        "username": usuario.username,
        "historial": historial.ultimos_turnos(conn, usuario.sub, settings.history_turns),
    }
    try:
        final = grafo.invoke(estado)
    except (httpx.HTTPError, ConnectionError) as exc:
        raise HTTPException(status_code=503, detail="El modelo de lenguaje no responde.") from exc
    except Exception as exc:
        # Ollama lanza ResponseError (p. ej. modelo no descargado)
        from ollama import ResponseError

        if isinstance(exc, ResponseError):
            raise HTTPException(
                status_code=503, detail=f"El modelo de lenguaje fallo: {exc.error}"
            ) from exc
        raise
    return RespuestaChat(
        respuesta=final["respuesta"],
        rechazada=final.get("rechazada", False),
        intencion=final["intencion"],
        fuentes=final.get("fuentes", []),
        historial_id=final["historial_id"],
    )


@router.get("/history", response_model=list[EntradaHistorial])
def obtener_historial(
    usuario: UsuarioActual,
    conn: Conexion,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return [vars(e) for e in historial.listar(conn, usuario.sub, limit, offset)]
