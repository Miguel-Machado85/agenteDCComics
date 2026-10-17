"""
Paso 2: descarga el wikitexto de las paginas de data/seed_titles.txt y lo
guarda en data/raw/ como archivos JSONL (lote_0001.jsonl, lote_0002.jsonl...).

Cada linea es una pagina:
    {"pageid", "title", "url", "revid", "timestamp", "categories", "wikitext"}

Reanudacion: el script anota cada titulo pedido en data/raw/solicitados.txt.
Al volver a correrlo solo pide los titulos que faltan (por ejemplo, si
cambiaste la seleccion) y los guarda en lotes nuevos. Tambien descarta paginas
que ya esten en disco aunque se hayan pedido con otro nombre (redirecciones).

Uso, desde backend/:
    uv run .\descargarArchivos.py
"""

import json
import time

from comun import PAUSA_SEG, RAW_DIR, SEED_TITLES, llamar_api, url_de

TITULOS_POR_LOTE = 50
SOLICITADOS = RAW_DIR / "solicitados.txt"
FALTANTES = RAW_DIR / "faltantes.txt"


def estado_en_disco():
    """Titulos ya pedidos, pageids ya guardados y siguiente numero de lote libre."""
    pedidos, pageids, mayor_lote = set(), set(), 0
    if SOLICITADOS.exists():
        pedidos.update(t for t in SOLICITADOS.read_text(encoding="utf-8").splitlines() if t)
    for ruta in sorted(RAW_DIR.glob("lote_*.jsonl")):
        mayor_lote = max(mayor_lote, int(ruta.stem.split("_")[1]))
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                p = json.loads(linea)
                pedidos.add(p["title"])  # compatibilidad con descargas sin solicitados.txt
                pageids.add(p["pageid"])
    return pedidos, pageids, mayor_lote + 1


def descargar_lote(titulos):
    """Devuelve (paginas, faltantes) para un lote de titulos."""
    params = {
        "action": "query",
        "titles": "|".join(titulos),
        "redirects": "1",
        "prop": "revisions|categories",
        "rvprop": "content|ids|timestamp",
        "rvslots": "main",
        "clshow": "!hidden",  # sin categorias ocultas de mantenimiento
        "cllimit": "max",
    }
    paginas, faltantes = {}, []
    while True:
        data = llamar_api(params)
        for p in data.get("query", {}).get("pages", []):
            if p.get("missing") or p.get("invalid"):
                faltantes.append(p.get("title", "?"))
                continue
            pag = paginas.setdefault(p["pageid"], {
                "pageid": p["pageid"],
                "title": p["title"],
                "url": url_de(p["title"]),
                "revid": None,
                "timestamp": None,
                "categories": [],
                "wikitext": None,
            })
            # La API puede repartir los datos de una pagina en varias respuestas
            for rev in p.get("revisions", []):
                pag["revid"] = rev.get("revid")
                pag["timestamp"] = rev.get("timestamp")
                pag["wikitext"] = rev.get("slots", {}).get("main", {}).get("content")
            for c in p.get("categories", []):
                nombre = c["title"].removeprefix("Category:")
                if nombre not in pag["categories"]:
                    pag["categories"].append(nombre)
        if "continue" not in data:
            break
        params.update(data["continue"])
        time.sleep(PAUSA_SEG)

    faltantes += [p["title"] for p in paginas.values() if not p["wikitext"]]
    return [p for p in paginas.values() if p["wikitext"]], faltantes


def main():
    titulos = [t for t in SEED_TITLES.read_text(encoding="utf-8").splitlines() if t.strip()]
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    pedidos, pageids, siguiente = estado_en_disco()

    pendientes = [t for t in titulos if t not in pedidos]
    lotes = [pendientes[i:i + TITULOS_POR_LOTE]
             for i in range(0, len(pendientes), TITULOS_POR_LOTE)]
    print(f"{len(titulos)} titulos en la seleccion; {len(pendientes)} pendientes "
          f"en {len(lotes)} lotes")

    inicio = time.time()
    for i, lote in enumerate(lotes, start=1):
        paginas, faltantes = descargar_lote(lote)
        nuevas = [p for p in paginas if p["pageid"] not in pageids]
        pageids.update(p["pageid"] for p in nuevas)

        if nuevas:
            ruta = RAW_DIR / f"lote_{siguiente:04d}.jsonl"
            temporal = ruta.with_suffix(".tmp")
            with open(temporal, "w", encoding="utf-8") as f:
                for p in nuevas:
                    f.write(json.dumps(p, ensure_ascii=False) + "\n")
            temporal.replace(ruta)  # el lote solo existe si se escribio completo
            siguiente += 1
        # Se anota despues de guardar: si se corta antes, el lote se vuelve a pedir
        with open(SOLICITADOS, "a", encoding="utf-8") as f:
            f.writelines(t + "\n" for t in lote)
        if faltantes:
            with open(FALTANTES, "a", encoding="utf-8") as f:
                f.writelines(t + "\n" for t in faltantes)

        minutos = (time.time() - inicio) / 60
        print(f"lote {i}/{len(lotes)}: {len(nuevas)} paginas nuevas"
              + (f", {len(paginas) - len(nuevas)} ya estaban" if len(paginas) > len(nuevas) else "")
              + (f", {len(faltantes)} faltantes" if faltantes else "")
              + f"  ({minutos:.1f} min)")
        time.sleep(PAUSA_SEG)

    total, mb = 0, 0.0
    for ruta in RAW_DIR.glob("lote_*.jsonl"):
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                total += 1
                mb += len(json.loads(linea)["wikitext"].encode("utf-8")) / 1e6
    print(f"\nListo: {total} paginas, {mb:.1f} MB de wikitexto en {RAW_DIR}")
    if FALTANTES.exists():
        print(f"Hay titulos sin descargar: ver {FALTANTES}")


if __name__ == "__main__":
    main()