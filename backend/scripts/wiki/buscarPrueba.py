"""
Prueba la busqueda vectorial: muestra los chunks mas parecidos a una pregunta
y su similitud. Sirve para verificar la carga y para calibrar el umbral de
grade_context (compara preguntas del dominio contra preguntas fuera de el).

Uso, desde backend/scripts/wiki/:
    uv run .\\buscarPrueba.py "who is Aquaman?"
    uv run .\\buscarPrueba.py "¿cuáles son los poderes del Detective Marciano?" -k 5
    uv run .\\buscarPrueba.py "¿cómo se prepara una arepa?"
"""

import argparse
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND))

from app.db.connection import get_connection  # noqa: E402
from app.services.retrieval import buscar  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pregunta")
    parser.add_argument("-k", type=int, default=10)
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    with get_connection() as conn:
        resultados = buscar(conn, args.pregunta, args.k)
    for r in resultados:
        fragmento = r.contenido.split("\n", 1)[-1][:160].replace("\n", " ")
        print(f"{r.similitud:.3f}  {r.titulo}  [{r.seccion}]")
        print(f"        {fragmento}...")


if __name__ == "__main__":
    main()
