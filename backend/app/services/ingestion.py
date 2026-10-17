"""
Ingesta: secciones de texto -> chunks -> embeddings -> pgvector.

La usan los dos caminos de entrada a la base de conocimiento:
- scripts/wiki/cargarPgvector.py, con las paginas limpias del wiki;
- POST /documents (mas adelante), con el texto extraido de un archivo subido,
  pasandolo como una sola seccion o partido por titulos.

Chunking:
1. Las secciones cortas consecutivas se juntan en un mismo chunk hasta
   CHUNK_SIZE caracteres (evita miles de chunks de 100 caracteres).
2. Las secciones largas se parten con RecursiveCharacterTextSplitter
   (900 caracteres, solapamiento de 150), cortando por parrafos y frases.
3. Cada chunk empieza con un encabezado: titulo, alias y seccion. Asi un
   fragmento suelto de "Powers" sabe de quien habla, y una pregunta por
   "Aquaman" encuentra la pagina "Orin (New Earth)".
"""

from dataclasses import dataclass, field
from typing import Callable, Iterable

import numpy as np
from langchain_text_splitters import RecursiveCharacterTextSplitter
from psycopg.types.json import Jsonb

from app.core.config import settings
from app.services.embeddings import embed_passages

MAX_ALIAS_ENCABEZADO = 6


@dataclass
class Seccion:
    nombre: str
    texto: str


@dataclass
class Documento:
    source: str                      # 'dc_wiki' | 'upload'
    source_id: str
    title: str
    secciones: list[Seccion]
    url: str | None = None
    alias: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
    uploaded_by: str | None = None


@dataclass
class Chunk:
    indice: int
    seccion: str
    contenido: str                   # encabezado + texto: lo que se embebe y ve el LLM


def _splitter() -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", ". ", "; ", ", ", " ", ""],
        keep_separator="end",
    )


def encabezado(titulo: str, alias: list[str], seccion: str) -> str:
    base = titulo.split(" (")[0].lower()
    otros = [a for a in alias if a.lower() not in (titulo.lower(), base)][:MAX_ALIAS_ENCABEZADO]
    partes = titulo + (f" (also known as: {', '.join(otros)})" if otros else "")
    return f"{partes} — {seccion}" if seccion else partes


def partir_en_chunks(doc: Documento) -> list[Chunk]:
    tam = settings.chunk_size
    splitter = _splitter()
    piezas: list[tuple[str, str]] = []   # (nombre de seccion, texto)
    grupo: list[Seccion] = []
    largo_grupo = 0

    def cerrar_grupo():
        nonlocal grupo, largo_grupo
        if not grupo:
            return
        if len(grupo) == 1:
            piezas.append((grupo[0].nombre, grupo[0].texto))
        else:
            nombres = [s.nombre for s in grupo]
            etiqueta = "; ".join(nombres[:3]) + ("; ..." if len(nombres) > 3 else "")
            cuerpo = "\n\n".join(f"{s.nombre}:\n{s.texto}" for s in grupo)
            piezas.append((etiqueta, cuerpo))
        grupo, largo_grupo = [], 0

    for s in doc.secciones:
        texto = s.texto.strip()
        if not texto:
            continue
        if len(texto) > tam:
            cerrar_grupo()
            for parte in splitter.split_text(texto):
                piezas.append((s.nombre, parte))
        elif largo_grupo + len(texto) + len(s.nombre) + 3 <= tam:
            grupo.append(Seccion(s.nombre, texto))
            largo_grupo += len(texto) + len(s.nombre) + 3
        else:
            cerrar_grupo()
            grupo, largo_grupo = [Seccion(s.nombre, texto)], len(texto) + len(s.nombre) + 3
    cerrar_grupo()

    return [
        Chunk(i, nombre, encabezado(doc.title, doc.alias, nombre) + "\n" + texto)
        for i, (nombre, texto) in enumerate(piezas)
    ]


def ingestar(
    conn,
    documentos: Iterable[Documento],
    embed: Callable[[list[str]], np.ndarray] = embed_passages,
) -> list[tuple[int, int]]:
    """Guarda varios documentos en una sola transaccion.

    Si un documento ya existe (mismo source y source_id), se reemplaza.
    Devuelve [(document_id, cantidad_de_chunks)] en el mismo orden.
    """
    documentos = list(documentos)
    chunks_por_doc = [partir_en_chunks(d) for d in documentos]
    todos = [c.contenido for cs in chunks_por_doc for c in cs]
    vectores = embed(todos) if todos else np.empty((0, settings.embedding_dim))

    resultado = []
    pos = 0
    with conn.transaction(), conn.cursor() as cur:
        for doc, chunks in zip(documentos, chunks_por_doc):
            cur.execute(
                "DELETE FROM documents WHERE source = %s AND source_id = %s",
                (doc.source, doc.source_id),
            )
            if not chunks:
                resultado.append((None, 0))
                continue
            cur.execute(
                """INSERT INTO documents (source, source_id, title, url, metadata, uploaded_by)
                   VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                (doc.source, doc.source_id, doc.title, doc.url,
                 Jsonb({**doc.metadata, "alias": doc.alias}), doc.uploaded_by),
            )
            doc_id = cur.fetchone()[0]
            cur.executemany(
                """INSERT INTO chunks (document_id, chunk_index, section, content, embedding)
                   VALUES (%s, %s, %s, %s, %s)""",
                [(doc_id, c.indice, c.seccion, c.contenido, vectores[pos + i])
                 for i, c in enumerate(chunks)],
            )
            pos += len(chunks)
            resultado.append((doc_id, len(chunks)))
    return resultado
