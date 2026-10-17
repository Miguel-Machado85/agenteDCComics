"""
Autenticacion: valida el JWT que emite Keycloak.

La firma se verifica con las llaves publicas del JWKS del realm (el cliente
las cachea, no se pide el JWKS en cada request). Ademas se exigen el issuer y
la audiencia de la API: un token valido de otro cliente o de otro realm no pasa.

El issuer esperado y la URL del JWKS son variables separadas porque pueden
diferir: el token lo emite el Keycloak que ve el navegador
(http://localhost:8080/...), pero si el backend corre en Docker las llaves se
piden por la red interna (http://keycloak:8080/...).

`usuario_actual` es la dependencia que protege todos los routers salvo /health.
El `sub` del token es la llave del historial y de `uploaded_by`.
"""

from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2AuthorizationCodeBearer
from jwt import PyJWKClient

from app.core.config import settings

# Solo documenta el flujo en Swagger y extrae el Bearer; el login lo hace el navegador
esquema_oauth = OAuth2AuthorizationCodeBearer(
    authorizationUrl=f"{settings.keycloak_issuer}/protocol/openid-connect/auth",
    tokenUrl=f"{settings.keycloak_issuer}/protocol/openid-connect/token",
    auto_error=False,
)


@dataclass
class Usuario:
    sub: str
    username: str


@lru_cache(maxsize=1)
def _cliente_jwks() -> PyJWKClient:
    return PyJWKClient(settings.keycloak_jwks_url, cache_keys=True)


def _no_autorizado(mensaje: str) -> HTTPException:
    return HTTPException(
        status_code=401,
        detail=mensaje,
        headers={"WWW-Authenticate": "Bearer"},
    )


def usuario_actual(token: str | None = Depends(esquema_oauth)) -> Usuario:
    if not token:
        raise _no_autorizado("Falta el token de autenticacion.")
    try:
        llave = _cliente_jwks().get_signing_key_from_jwt(token).key
        datos = jwt.decode(
            token,
            llave,
            algorithms=["RS256"],
            audience=settings.keycloak_audience,
            issuer=settings.keycloak_issuer,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.PyJWKClientConnectionError:
        raise HTTPException(
            status_code=503, detail="No se pudo contactar a Keycloak para validar el token."
        )
    except jwt.ExpiredSignatureError:
        raise _no_autorizado("El token expiro. Inicia sesion de nuevo.")
    except jwt.PyJWTError:
        raise _no_autorizado("Token invalido.")
    return Usuario(sub=datos["sub"], username=datos.get("preferred_username", datos["sub"]))
