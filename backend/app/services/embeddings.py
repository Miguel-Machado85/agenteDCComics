"""
Embeddings con intfloat/multilingual-e5-small.

E5 se entreno con prefijos: los textos de la base van con "passage: " y las
preguntas con "query: ". Si se omiten, la similitud baja y el agente rechaza
preguntas validas. Los vectores salen normalizados (largo 1), asi que la
similitud coseno es 1 - distancia (<=> en pgvector).
"""

from functools import lru_cache

import numpy as np

from app.core.config import settings


@lru_cache(maxsize=1)
def _modelo():
    # Import aqui: cargar torch tarda varios segundos y no siempre hace falta
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(settings.embedding_model, device="cpu")


def embed_passages(textos: list[str]) -> np.ndarray:
    return _modelo().encode(
        ["passage: " + t for t in textos],
        batch_size=settings.embedding_batch_size,
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True,
    )


def embed_query(texto: str) -> np.ndarray:
    return _modelo().encode(
        ["query: " + texto],
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True,
    )[0]
