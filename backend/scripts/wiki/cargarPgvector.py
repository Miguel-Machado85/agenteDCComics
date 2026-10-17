"""
Paso 4: carga las paginas limpias (data/clean/) en PostgreSQL + pgvector:
chunking, embeddings con multilingual-e5-small y guardado.

- Crea las tablas si no existen.
- Reanudable: salta las paginas que ya estan en la base. Si se corta,
  vuelve a correrlo y sigue donde iba.
- --limite N carga solo una muestra de N paginas repartidas por toda la
  seleccion (mas unas paginas fijas de prueba). Sirve para probar rapido.
- --reemplazar vuelve a cargar tambien las que ya estaban (por ejemplo, si
  cambiaste la limpieza o el chunking).

Requisitos: Postgres corriendo (docker compose up -d db) y DATABASE_URL en el
.env de la raiz. La primera vez descarga el modelo (~470 MB).

Uso, desde backend/scripts/wiki/:
    uv run .\\cargarPgvector.py --limite 300
    uv run .\\cargarPgvector.py
"""

import argparse
import json
import sys
import time
from pathlib import Path

# Permite importar el paquete app/ del backend al correr este archivo directamente
BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND))

from app.db.connection import get_connection, init_db  # noqa: E402
from app.services.ingestion import Documento, Seccion, ingestar  # noqa: E402
from comun import DATA_DIR  # noqa: E402

CLEAN_DIR = DATA_DIR / "clean"
SOURCE = "dc_wiki"
PAGINAS_POR_TRANSACCION = 25

# Siempre se incluyen en la muestra de --limite, para poder probar la busqueda
PAGINAS_DE_PRUEBA = [
    "Aquaman (Arthur Curry)",
    "Batman (Bruce Wayne)",
    "Superman (Clark Kent)",
    "J'onn J'onzz (Prime Earth)",
    "Justice League (Prime Earth)",
    "Gotham City",
]


def leer_paginas():
    for ruta in sorted(CLEAN_DIR.glob("lote_*.jsonl")):
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                yield json.loads(linea)


def a_documento(p) -> Documento:
    return Documento(
        source=SOURCE,
        source_id=str(p["pageid"]),
        title=p["title"],
        url=p["url"],
        alias=p["alias"],
        secciones=[Seccion(s["seccion"], s["texto"]) for s in p["secciones"]],
        metadata={
            "tipo": p["tipo"],
            "nombre": p["nombre"],
            "categories": p["categories"],
            "revid": p["revid"],
            "timestamp": p["timestamp"],
        },
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limite", type=int, help="cargar solo una muestra de N paginas")
    parser.add_argument("--reemplazar", action="store_true",
                        help="volver a cargar paginas que ya estan en la base")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    paginas = list(leer_paginas())
    if not paginas:
        sys.exit(f"No hay paginas en {CLEAN_DIR}: corre primero la limpieza")
    if args.limite:
        paso = max(1, len(paginas) // args.limite)
        muestra = paginas[::paso][: args.limite]
        titulos = {p["title"] for p in muestra}
        muestra += [p for p in paginas if p["title"] in PAGINAS_DE_PRUEBA and p["title"] not in titulos]
        paginas = muestra

    init_db()
    with get_connection() as conn:
        ya_cargadas = set()
        if not args.reemplazar:
            ya_cargadas = {r[0] for r in conn.execute(
                "SELECT source_id FROM documents WHERE source = %s", (SOURCE,))}
        pendientes = [p for p in paginas if str(p["pageid"]) not in ya_cargadas]
        print(f"{len(paginas)} paginas seleccionadas; {len(pendientes)} por cargar "
              f"({len(paginas) - len(pendientes)} ya estaban)")

        print("Cargando el modelo de embeddings (la primera vez lo descarga)...")
        inicio = time.time()
        hechas = chunks = 0
        for i in range(0, len(pendientes), PAGINAS_POR_TRANSACCION):
            lote = [a_documento(p) for p in pendientes[i:i + PAGINAS_POR_TRANSACCION]]
            resultado = ingestar(conn, lote)
            hechas += len(lote)
            chunks += sum(n for _, n in resultado)

            transcurrido = time.time() - inicio
            ritmo = chunks / transcurrido if transcurrido else 0
            restantes = (len(pendientes) - hechas) * (chunks / hechas) / ritmo if ritmo else 0
            print(f"{hechas}/{len(pendientes)} paginas, {chunks} chunks "
                  f"({ritmo:.0f} chunks/s, faltan ~{restantes / 60:.0f} min)")

        conn.execute("ANALYZE documents; ANALYZE chunks")
        n_docs, n_chunks = conn.execute(
            "SELECT (SELECT count(*) FROM documents), (SELECT count(*) FROM chunks)").fetchone()
        tamano = conn.execute(
            "SELECT pg_size_pretty(pg_database_size(current_database()))").fetchone()[0]
        conn.commit()
    print(f"\nListo en {(time.time() - inicio) / 60:.1f} min. En la base: "
          f"{n_docs} documentos, {n_chunks} chunks, {tamano}")


if __name__ == "__main__":
    main()
