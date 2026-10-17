"""Cliente del LLM (Ollama). Se crea una vez y se reutiliza."""

from functools import lru_cache

from app.core.config import settings


@lru_cache(maxsize=2)
def crear_llm(modo_json: bool = False):
    # Import aqui: langchain_ollama es pesado y los tests no lo necesitan
    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=settings.llm_model,
        base_url=settings.ollama_base_url,
        temperature=0,
        # Ollama trunca el contexto en silencio con el valor por defecto
        num_ctx=settings.llm_num_ctx,
        format="json" if modo_json else None,
    )
