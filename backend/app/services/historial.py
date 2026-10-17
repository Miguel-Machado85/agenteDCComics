"""
Historial de chat por usuario (tabla chat_history).

El historial cumple dos papeles: GET /history lo muestra al usuario y
rewrite_query usa los ultimos turnos para resolver referencias como
"¿y sus poderes?". La llave es el `sub` del token de Keycloak.
"""

from dataclasses import dataclass
from datetime import datetime

from psycopg.types.json import Jsonb


@dataclass
class EntradaHistorial:
    id: int
    pregunta: str
    respuesta: str
    rechazada: bool
    fuentes: list[dict]
    creado: datetime


def guardar(
    conn,
    user_sub: str,
    username: str | None,
    pregunta: str,
    respuesta: str,
    rechazada: bool,
    intencion: str | None,
    fuentes: list[dict],
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO chat_history
                   (user_sub, username, question, answer, rejected, intent, sources)
               VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (user_sub, username, pregunta, respuesta, rechazada, intencion, Jsonb(fuentes)),
        )
        nuevo_id = cur.fetchone()[0]
    conn.commit()
    return nuevo_id


def listar(conn, user_sub: str, limit: int = 20, offset: int = 0) -> list[EntradaHistorial]:
    """Entradas del usuario, la mas reciente primero."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, question, answer, rejected, sources, created_at
                 FROM chat_history
                WHERE user_sub = %s
                ORDER BY created_at DESC, id DESC
                LIMIT %s OFFSET %s""",
            (user_sub, limit, offset),
        )
        return [EntradaHistorial(*fila) for fila in cur.fetchall()]


def ultimos_turnos(conn, user_sub: str, cantidad: int) -> list[dict]:
    """Ultimos turnos en orden cronologico, para dar contexto a rewrite_query."""
    if cantidad <= 0:
        return []
    entradas = listar(conn, user_sub, limit=cantidad)
    return [{"pregunta": e.pregunta, "respuesta": e.respuesta} for e in reversed(entradas)]
