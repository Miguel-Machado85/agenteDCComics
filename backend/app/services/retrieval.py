"""Busqueda por similitud en pgvector (la usara el nodo `retrieve` del grafo)."""

from dataclasses import dataclass

from app.services.embeddings import embed_query


@dataclass
class Resultado:
    similitud: float
    titulo: str
    url: str | None
    seccion: str | None
    contenido: str
    document_id: int


def buscar(conn, pregunta: str, k: int = 10) -> list[Resultado]:
    """Devuelve los k chunks mas parecidos a la pregunta (similitud coseno, 0 a 1)."""
    vector = embed_query(pregunta)
    with conn.cursor() as cur:
        cur.execute("SET LOCAL hnsw.ef_search = 100")  # mas precision que el default (40)
        cur.execute(
            """SELECT 1 - (c.embedding <=> %s) AS similitud,
                      d.title, d.url, c.section, c.content, d.id
                 FROM chunks c JOIN documents d ON d.id = c.document_id
                ORDER BY c.embedding <=> %s
                LIMIT %s""",
            (vector, vector, k),
        )
        return [Resultado(*fila) for fila in cur.fetchall()]
