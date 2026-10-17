"""
Configuracion del backend. Se lee de variables de entorno o del archivo .env
de la raiz del repositorio (en Docker, compose pasa las variables).
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> parents[3] es la raiz del repositorio
RAIZ_REPO = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=RAIZ_REPO / ".env", extra="ignore")

    database_url: str = "postgresql://dcagent:dcagent@localhost:5432/dcagent"

    # Si cambias el modelo, cambia tambien EMBEDDING_DIM y la columna
    # vector(384) de app/db/schema.sql, y vuelve a cargar la base.
    embedding_model: str = "intfloat/multilingual-e5-small"
    embedding_dim: int = 384
    embedding_batch_size: int = 32

    chunk_size: int = 900
    chunk_overlap: int = 150


settings = Settings()
