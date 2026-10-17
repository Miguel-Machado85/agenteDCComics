"""
Validacion de JWT con una llave RSA generada en el test (sin Keycloak).

Se reemplaza el cliente JWKS por uno que devuelve la llave publica de prueba;
asi se ejercita la verificacion real de firma, issuer, audiencia y expiracion.
"""

import time
from types import SimpleNamespace
from typing import Annotated

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core import auth
from app.core.config import settings


@pytest.fixture(scope="module")
def llave():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def cliente(llave, monkeypatch):
    publica = llave.public_key()
    falso = SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=publica))
    monkeypatch.setattr(auth, "_cliente_jwks", lambda: falso)

    app = FastAPI()

    @app.get("/yo")
    def yo(usuario: Annotated[auth.Usuario, Depends(auth.usuario_actual)]):
        return {"sub": usuario.sub, "username": usuario.username}

    return TestClient(app)


def token(llave, **cambios):
    claims = {
        "sub": "abc-123",
        "preferred_username": "demo",
        "iss": settings.keycloak_issuer,
        "aud": settings.keycloak_audience,
        "exp": int(time.time()) + 300,
    }
    claims.update(cambios)
    return jwt.encode(claims, llave, algorithm="RS256")


def con(t):
    return {"Authorization": f"Bearer {t}"}


def test_token_valido(cliente, llave):
    r = cliente.get("/yo", headers=con(token(llave)))
    assert r.status_code == 200
    assert r.json() == {"sub": "abc-123", "username": "demo"}


def test_sin_token(cliente):
    r = cliente.get("/yo")
    assert r.status_code == 401
    assert "detail" in r.json()


def test_firma_mala(cliente):
    otra = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert cliente.get("/yo", headers=con(token(otra))).status_code == 401


def test_audiencia_mala(cliente, llave):
    assert cliente.get("/yo", headers=con(token(llave, aud="otra-api"))).status_code == 401


def test_issuer_malo(cliente, llave):
    assert cliente.get("/yo", headers=con(token(llave, iss="http://otro/realms/x"))).status_code == 401


def test_token_expirado(cliente, llave):
    r = cliente.get("/yo", headers=con(token(llave, exp=int(time.time()) - 10)))
    assert r.status_code == 401


def test_token_basura(cliente):
    assert cliente.get("/yo", headers=con("no-es-un-jwt")).status_code == 401
