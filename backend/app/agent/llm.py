"""Cliente del LLM (Ollama). Se crea una vez y se reutiliza.

Limites de cada llamada (medidos en la EC2 de 2 vCPU):
- num_predict: tope de tokens de salida. Sin el, un 3B que entra en bucle
  repitiendo una lista (p. ej. miembros de un equipo) genera hasta llenar la
  ventana de contexto: decenas de minutos con la CPU al 100 % y las demas
  preguntas en fila detras.
- timeout: si Ollama no termina a tiempo, el cliente cierra la conexion,
  Ollama cancela la generacion y /chat responde 503 en vez de quedarse colgado.
"""

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
        # Las respuestas JSON (intencion, veredicto) son cortas
        num_predict=settings.llm_num_predict_json if modo_json else settings.llm_num_predict,
        # None: Ollama decide (en 2 vCPU suele usar 1 hilo)
        num_thread=settings.llm_num_thread,
        format="json" if modo_json else None,
        client_kwargs={"timeout": settings.llm_timeout_s},
    )
