"""
Configuracion del backend. Se lee de variables de entorno o del archivo .env
de la raiz del repositorio (en Docker, compose pasa las variables).
"""

from pathlib import Path

from pydantic import field_validator
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

    # --- Keycloak ---
    # El issuer es lo que ve el navegador (va dentro del token); la URL del JWKS
    # puede ser interna si el backend corre en Docker (http://keycloak:8080/...)
    keycloak_issuer: str = "http://localhost:8080/realms/dc-comics"
    keycloak_jwks_url: str = (
        "http://localhost:8080/realms/dc-comics/protocol/openid-connect/certs"
    )
    keycloak_audience: str = "dc-api"
    keycloak_client_id: str = "dc-frontend"

    # --- LLM (Ollama) ---
    ollama_base_url: str = "http://localhost:11434"
    llm_model: str = "qwen2.5:3b"
    llm_num_ctx: int = 8192
    # Tope de tokens de salida: corta los bucles de repeticion del 3B
    llm_num_predict: int = 600
    llm_num_predict_json: int = 100
    # Segundos maximos por llamada; al vencer, Ollama cancela y /chat da 503
    llm_timeout_s: float = 300
    # Hilos de CPU para Ollama (None: los decide Ollama)
    llm_num_thread: int | None = None

    # --- Agente ---
    similarity_threshold: float = 0.70
    retrieval_top_k: int = 10
    strong_min_chunks: int = 3
    strong_top1: float = 0.82
    strong_top3_avg: float = 0.78
    max_chunks_prompt: int = 10
    # Con strong retrieval no se llama al grader del LLM (su veredicto no cambia
    # la decision). false: siempre se llama, util para medir el grader
    skip_grader_if_strong: bool = True
    history_turns: int = 3
    # Tambien buscar con la pregunta original (ademas de la consulta en ingles)
    search_original_question: bool = True
    # Generar en ingles y traducir la respuesta si la pregunta no esta en ingles
    translate_answers: bool = True

    # --- API ---
    cors_origins: str = "http://localhost:5173"
    max_upload_mb: int = 10
    preload_embeddings: bool = False

    @field_validator("llm_num_thread", mode="before")
    @classmethod
    def _vacio_es_none(cls, valor):
        # LLM_NUM_THREAD= (vacio) en el .env significa "que decida Ollama"
        return None if isinstance(valor, str) and not valor.strip() else valor

    @property
    def lista_cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
