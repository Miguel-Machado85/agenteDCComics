"""Conexion a PostgreSQL + pgvector."""

from pathlib import Path

import psycopg
from pgvector.psycopg import register_vector

from app.core.config import settings

SCHEMA = Path(__file__).with_name("schema.sql")


def get_connection() -> psycopg.Connection:
    """Abre una conexion con el tipo vector registrado (numpy <-> vector)."""
    conn = psycopg.connect(settings.database_url)
    register_vector(conn)
    return conn


def init_db() -> None:
    """Crea la extension, las tablas y los indices si no existen."""
    with psycopg.connect(settings.database_url, autocommit=True) as conn:
        conn.execute(SCHEMA.read_text(encoding="utf-8"))
