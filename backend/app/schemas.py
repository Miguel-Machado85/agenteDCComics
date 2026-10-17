"""
Esquemas Pydantic de la API (el contrato que consume el frontend).

Las claves JSON van en espanol, igual que los dataclasses internos. Los
dataclasses del agente y de los servicios no se exponen directamente: estos
modelos son la unica forma publica de las respuestas.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class Salud(BaseModel):
    status: str = "ok"


class PreguntaIn(BaseModel):
    pregunta: str = Field(min_length=1, max_length=2000)


class Fuente(BaseModel):
    document_id: int
    titulo: str
    url: str | None
    seccion: str | None
    similitud: float
    fragmento: str


class RespuestaChat(BaseModel):
    respuesta: str
    rechazada: bool
    intencion: str
    fuentes: list[Fuente]
    historial_id: int


class EntradaHistorial(BaseModel):
    id: int
    pregunta: str
    respuesta: str
    rechazada: bool
    fuentes: list[Fuente]
    creado: datetime


class DocumentoSubido(BaseModel):
    id: int
    titulo: str
    chunks: int
    mensaje: str


class DocumentoItem(BaseModel):
    id: int
    titulo: str
    source: str
    url: str | None
    uploaded_by: str | None
    chunks: int
    creado: datetime


class ListaDocumentos(BaseModel):
    total: int
    items: list[DocumentoItem]
