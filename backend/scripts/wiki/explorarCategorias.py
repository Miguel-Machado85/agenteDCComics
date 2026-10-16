"""
Paso 0 (exploracion, opcional): lista las categorias de DC Database con al
menos MIN_PAGINAS paginas y las guarda ordenadas en data/categorias_dc.csv.
Sirve para decidir que categorias usar en seleccionar_paginas.py.

No descarga articulos. Uso, desde backend/:
    uv run .\explorarCategorias.py
"""

import csv
import time

from comun import DATA_DIR, PAUSA_SEG, llamar_api

MIN_PAGINAS = 100
SALIDA = DATA_DIR / "categorias_dc.csv"


def main():
    params = {
        "action": "query",
        "list": "allcategories",
        "acprop": "size",
        "acmin": str(MIN_PAGINAS),
        "aclimit": "500",
    }
    categorias = []
    lote = 0
    while True:
        data = llamar_api(params)
        lote += 1
        for c in data.get("query", {}).get("allcategories", []):
            categorias.append((c["category"], c.get("pages", 0), c.get("size", 0)))
        print(f"lote {lote}: {len(categorias)} categorias acumuladas")
        if "continue" not in data:
            break
        params.update(data["continue"])
        time.sleep(PAUSA_SEG)

    categorias.sort(key=lambda c: c[1], reverse=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["categoria", "paginas", "miembros_totales"])
        w.writerows(categorias)
    print(f"\nListo: {len(categorias)} categorias guardadas en {SALIDA}")


if __name__ == "__main__":
    main()