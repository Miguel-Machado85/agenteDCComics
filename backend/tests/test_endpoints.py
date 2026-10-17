"""
Endpoints con TestClient y dependencias sobrescritas: sin token real, sin
Postgres, sin Ollama. La conexion es un doble que devuelve filas guardadas.
"""

from datetime import UTC, datetime

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.auth import Usuario, usuario_actual
from app.db.connection import obtener_conexion
from app.main import app
from app.routers import chat as router_chat
from app.routers import documents as router_documents
from app.routers.chat import obtener_grafo
from app.services import historial
from app.services.historial import EntradaHistorial


class CursorFalso:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params=None):
        self.conn.consultas.append((sql, params))

    def fetchone(self):
        return self.conn.filas.pop(0)

    def fetchall(self):
        return self.conn.filas.pop(0)


class ConexionFalsa:
    def __init__(self, filas=None):
        self.filas = list(filas or [])
        self.consultas = []
        self.commits = 0

    def cursor(self):
        return CursorFalso(self)

    def commit(self):
        self.commits += 1


class GrafoFalso:
    def __init__(self, resultado=None, error=None):
        self.resultado, self.error, self.estado = resultado, error, None

    def invoke(self, estado):
        self.estado = estado
        if self.error:
            raise self.error
        return self.resultado


@pytest.fixture
def conn():
    return ConexionFalsa()


@pytest.fixture
def cliente(conn):
    app.dependency_overrides[usuario_actual] = lambda: Usuario(sub="u1", username="demo")
    app.dependency_overrides[obtener_conexion] = lambda: conn
    yield TestClient(app)
    app.dependency_overrides.clear()


def con_grafo(grafo):
    app.dependency_overrides[obtener_grafo] = lambda: grafo


# --- salud y autenticacion ---

def test_health_sin_token():
    assert TestClient(app).get("/health").json() == {"status": "ok"}


@pytest.mark.parametrize("metodo,ruta", [
    ("post", "/chat"), ("get", "/history"), ("get", "/documents"),
    ("post", "/documents"), ("delete", "/documents/1"),
])
def test_rutas_protegidas_sin_token(metodo, ruta):
    assert getattr(TestClient(app), metodo)(ruta).status_code == 401


# --- chat e historial ---

def test_chat(cliente, monkeypatch):
    monkeypatch.setattr(router_chat.historial, "ultimos_turnos", lambda *a: [])
    grafo = GrafoFalso({
        "respuesta": "Es un kriptoniano.", "rechazada": False, "intencion": "pregunta",
        "fuentes": [{"document_id": 1, "titulo": "Superman", "url": None, "seccion": "Powers",
                     "similitud": 0.9, "fragmento": "texto"}],
        "historial_id": 5,
    })
    con_grafo(grafo)
    r = cliente.post("/chat", json={"pregunta": "  who is Superman? "})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["historial_id"] == 5 and cuerpo["fuentes"][0]["titulo"] == "Superman"
    assert grafo.estado["pregunta"] == "who is Superman?"
    assert grafo.estado["usuario_sub"] == "u1"


def test_chat_pregunta_vacia(cliente):
    assert cliente.post("/chat", json={"pregunta": ""}).status_code == 422


def test_chat_ollama_caido_da_503(cliente, monkeypatch):
    monkeypatch.setattr(router_chat.historial, "ultimos_turnos", lambda *a: [])
    con_grafo(GrafoFalso(error=httpx.ConnectError("sin conexion")))
    r = cliente.post("/chat", json={"pregunta": "hola"})
    assert r.status_code == 503
    assert "modelo" in r.json()["detail"]


def test_historial(cliente, monkeypatch):
    entrada = EntradaHistorial(3, "q", "a", False, [], datetime(2026, 1, 1, tzinfo=UTC))
    monkeypatch.setattr(historial, "listar", lambda conn, sub, limit, offset: [entrada])
    r = cliente.get("/history?limit=5")
    assert r.status_code == 200
    assert r.json()[0]["pregunta"] == "q"
    assert cliente.get("/history?limit=0").status_code == 422


# --- documentos ---

def test_subir_documento(cliente, monkeypatch):
    llamadas = []
    monkeypatch.setattr(router_documents, "ingestar",
                        lambda c, docs: llamadas.append(docs[0]) or [(7, 2)])
    r = cliente.post("/documents", files={"archivo": ("hero.md", b"# Titulo\ncontenido", "text/markdown")})
    assert r.status_code == 201
    assert r.json()["id"] == 7 and r.json()["chunks"] == 2 and r.json()["titulo"] == "hero"
    doc = llamadas[0]
    assert doc.source == "upload" and doc.uploaded_by == "u1"
    assert doc.metadata["tipo"] == "md" and doc.metadata["archivo"] == "hero.md"


def test_subir_formato_no_soportado(cliente):
    r = cliente.post("/documents", files={"archivo": ("a.mp4", b"xx", "video/mp4")})
    assert r.status_code == 415


def test_subir_archivo_muy_grande(cliente, monkeypatch):
    monkeypatch.setattr(router_documents.settings, "max_upload_mb", 0)
    r = cliente.post("/documents", files={"archivo": ("a.txt", b"x", "text/plain")})
    assert r.status_code == 413


def test_subir_sin_texto(cliente):
    r = cliente.post("/documents", files={"archivo": ("a.txt", b"   ", "text/plain")})
    assert r.status_code == 422


def test_listar_documentos(cliente, conn):
    ahora = datetime(2026, 1, 1, tzinfo=UTC)
    conn.filas = [(2,), [(1, "Batman", "dc_wiki", "http://x", None, 4, ahora),
                         (2, "Mi nota", "upload", None, "u1", 1, ahora)]]
    r = cliente.get("/documents?source=upload&limit=2")
    assert r.status_code == 200
    assert r.json()["total"] == 2 and r.json()["items"][1]["chunks"] == 1
    assert conn.consultas[0][1] == ("upload", "upload")


def test_borrar_documento_propio(cliente, conn):
    conn.filas = [("upload", "u1")]
    assert cliente.delete("/documents/9").status_code == 204
    assert conn.commits == 1


def test_borrar_documento_ajeno_o_del_wiki(cliente, conn):
    conn.filas = [("upload", "otro")]
    assert cliente.delete("/documents/9").status_code == 403
    conn.filas = [("dc_wiki", None)]
    assert cliente.delete("/documents/9").status_code == 403


def test_borrar_documento_inexistente(cliente, conn):
    conn.filas = [None]
    assert cliente.delete("/documents/9").status_code == 404
