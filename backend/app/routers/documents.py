"""
Endpoints de documentos: subir, listar y borrar.

Subir: recibir -> extraer -> chunking -> embeddings -> pgvector -> confirmar.
El source_id es el hash del contenido junto con el usuario: subir el mismo
archivo otra vez lo reemplaza, pero un usuario nunca pisa el documento de otro.
Errores: 415 formato no soportado, 413 archivo muy grande, 422 sin texto.
"""

import hashlib
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile

from app.core.auth import Usuario, usuario_actual
from app.core.config import settings
from app.db.connection import obtener_conexion
from app.schemas import DocumentoItem, DocumentoSubido, ListaDocumentos
from app.services.extraccion import FormatoNoSoportado, SinTexto, extraer
from app.services.ingestion import Documento, ingestar

router = APIRouter(prefix="/documents", tags=["documents"])

UsuarioActual = Annotated[Usuario, Depends(usuario_actual)]
Conexion = Annotated[object, Depends(obtener_conexion)]


@router.post("", response_model=DocumentoSubido, status_code=201)
def subir_documento(archivo: UploadFile, usuario: UsuarioActual, conn: Conexion):
    nombre = Path(archivo.filename or "").name
    maximo = settings.max_upload_mb * 1024 * 1024
    datos = archivo.file.read(maximo + 1)
    if len(datos) > maximo:
        raise HTTPException(
            status_code=413, detail=f"El archivo supera el maximo de {settings.max_upload_mb} MB."
        )
    try:
        secciones = extraer(nombre, datos)
    except FormatoNoSoportado as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except SinTexto as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    huella = hashlib.sha256(usuario.sub.encode() + b"\0" + datos).hexdigest()
    doc = Documento(
        source="upload",
        source_id=huella,
        title=Path(nombre).stem,
        secciones=secciones,
        uploaded_by=usuario.sub,
        metadata={
            "archivo": nombre,
            "tipo": Path(nombre).suffix.lower().lstrip("."),
            "tamano": len(datos),
        },
    )
    doc_id, chunks = ingestar(conn, [doc])[0]
    if doc_id is None:
        raise HTTPException(status_code=422, detail="No se pudo extraer texto del archivo.")
    return DocumentoSubido(
        id=doc_id,
        titulo=doc.title,
        chunks=chunks,
        mensaje=f"Documento procesado: {chunks} fragmentos listos para consultar.",
    )


@router.get("", response_model=ListaDocumentos)
def listar_documentos(
    usuario: UsuarioActual,
    conn: Conexion,
    source: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    # Hay miles de paginas del wiki: siempre paginado
    with conn.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM documents WHERE (%s::text IS NULL OR source = %s)",
            (source, source),
        )
        total = cur.fetchone()[0]
        cur.execute(
            """SELECT d.id, d.title, d.source, d.url, d.uploaded_by,
                      (SELECT count(*) FROM chunks c WHERE c.document_id = d.id) AS chunks,
                      d.created_at
                 FROM documents d
                WHERE (%s::text IS NULL OR d.source = %s)
                ORDER BY d.created_at DESC, d.id DESC
                LIMIT %s OFFSET %s""",
            (source, source, limit, offset),
        )
        items = [
            DocumentoItem(id=f[0], titulo=f[1], source=f[2], url=f[3], uploaded_by=f[4],
                          chunks=f[5], creado=f[6])
            for f in cur.fetchall()
        ]
    return ListaDocumentos(total=total, items=items)


@router.delete("/{documento_id}", status_code=204)
def borrar_documento(documento_id: int, usuario: UsuarioActual, conn: Conexion):
    with conn.cursor() as cur:
        cur.execute("SELECT source, uploaded_by FROM documents WHERE id = %s", (documento_id,))
        fila = cur.fetchone()
        if fila is None:
            raise HTTPException(status_code=404, detail="El documento no existe.")
        source, subido_por = fila
        if source != "upload" or subido_por != usuario.sub:
            raise HTTPException(
                status_code=403, detail="Solo puedes borrar documentos que subiste tu."
            )
        cur.execute("DELETE FROM documents WHERE id = %s", (documento_id,))  # chunks: CASCADE
    conn.commit()
    return Response(status_code=204)
