"""
Paso 1: decide que paginas de DC Database entran en la base de conocimiento
y estima cuantos chunks saldrian, SIN descargar los articulos.

Para cada categoria configurada pide la lista de paginas y su tamano, aplica
las reglas de seleccion y escribe:

    data/seed_titles.txt        titulos elegidos, uno por linea (se versiona)
    data/seleccion_resumen.csv  titulo, grupo, tamano y chunks estimados

Las listas se guardan en data/cache_categorias/: si cambias las reglas y lo
vuelves a correr, no repite peticiones.

Reglas:
- personajes: estan en el universo principal (New Earth o Prime Earth) Y en
  alguna categoria de relevancia (equipos, familias, villanos).
- mundo: equipos, lugares, objetos, eventos... sin versiones de otras Tierras
  ni de series, juegos o peliculas.

Uso, desde backend/:
    uv run .\seleccionarPaginas.py
"""

import csv
import json
import math
import re
import time

from comun import CACHE_DIR, DATA_DIR, PAUSA_SEG, SEED_TITLES, llamar_api

# ---------------------------------------------------------------------------
# Reglas de seleccion (edita aqui)
# ---------------------------------------------------------------------------

# Personajes: deben estar en alguna de estas (universo principal)...
UNIVERSO_PRINCIPAL = [
    "New Earth Characters",
    "Prime Earth Characters",
]

# ...Y en alguna de estas (equipos, familias y villanos relevantes).
RELEVANCIA = [
    "Justice League of America members",
    "Justice League Unlimited members",
    "Justice Society of America members",
    "Batman Family members",
    "Superman Family members",
    "Flash Family members",
    "Green Lantern Corps members",
    "Sinestro Corps members",
    "Teen Titans members",
    "Titans members",
    "Suicide Squad members",
    "Legion of Super-Heroes members",
    "Doom Patrol members",
    "Outsiders members",
    "Marvel Family members",
    "League of Assassins members",
    "Legion of Doom members",
    "Secret Society of Super-Villains members",
    "Rogues Gallery members",
    "Batman Villains",
    "Superman villains",
    "Wonder Woman villains",
    "Flash villains",
    "Green Lantern villains",
    "Justice League villains",
    "Titans villains",
    "Green Arrow villains",
    "Aquaman Villains",
]

# El "mundo": equipos, lugares, objetos, eventos... (entran por si solas)
MUNDO = [
    "Teams",
    "Organizations",
    "Locations",
    "Items",
    "Events",
    "Races",
    "Weapons",
    "Realities",
]

# Paginas en estas categorias se descartan siempre
EXCLUIR = [
    "Disambiguation Pages",
    "Empty pages",
]

# Solo para el grupo MUNDO: si el titulo termina en parentesis, solo se aceptan
# estos universos. "Justice League (Earth-2)" se descarta; "Justice League
# (Prime Earth)" y "Gotham City" se aceptan.
# A los personajes NO se les aplica: el wiki nombra las paginas actuales como
# "Batman (Bruce Wayne)", y las categorias ya garantizan que son del universo
# principal.
PARENTESIS_PERMITIDOS = {"New Earth", "Prime Earth"}

# Titulos que empiezan asi se descartan: son de series, juegos o peliculas,
# no de los comics (entran por la categoria "Realities").
EXCLUIR_PREFIJOS = (
    "Arrowverse",
    "DC Universe Online",
    "DC Legends",
    "DC Extended Universe",
    "DCAU",
    "Smallville",
)

# Paginas que entran siempre, aunque no las atrapen las categorias.
# Se comprueba que existan y se siguen las redirecciones.
INCLUIR_SIEMPRE = [
    "Bruce Wayne (Prime Earth)",
    "Kal-El (Prime Earth)",
    "Diana of Themyscira (Prime Earth)",
    "Barry Allen (Prime Earth)",
    "Hal Jordan (Prime Earth)",
    "Arthur Curry (Prime Earth)",
]

# Umbrales de tamano (bytes de wikitexto) para la tabla de estimacion
UMBRALES = [0, 2000, 4000, 8000, 15000]
# Umbral por grupo con el que se escribe seed_titles.txt
UMBRAL_ELEGIDO = {"personajes": 0, "mundo": 2000, "forzadas": 0}

# Estimacion de chunks: el wikitexto pierde ~45 % al limpiarlo (plantillas,
# referencias, enlaces). Chunks de 900 caracteres con solapamiento de 150.
FACTOR_LIMPIEZA = 0.55
CHUNK_SIZE, CHUNK_OVERLAP = 900, 150

# ---------------------------------------------------------------------------


def ruta_cache(categoria):
    return CACHE_DIR / (re.sub(r"[^\w\-]+", "_", categoria) + ".json")


def paginas_de_categoria(categoria):
    """Devuelve {titulo: tamano_en_bytes} de los articulos (ns 0) de la categoria."""
    ruta = ruta_cache(categoria)
    if ruta.exists():
        return json.loads(ruta.read_text(encoding="utf-8"))

    print(f"  descargando lista: {categoria}")
    params = {
        "action": "query",
        "generator": "categorymembers",
        "gcmtitle": "Category:" + categoria,
        "gcmnamespace": "0",
        "gcmtype": "page",
        "gcmlimit": "500",
        "prop": "info",
    }
    paginas = {}
    while True:
        data = llamar_api(params)
        for p in data.get("query", {}).get("pages", []):
            if not p.get("missing"):
                paginas[p["title"]] = p.get("length", 0)
        if "continue" not in data:
            break
        params.update(data["continue"])
        time.sleep(PAUSA_SEG)
    time.sleep(PAUSA_SEG)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(paginas, ensure_ascii=False), encoding="utf-8")
    print(f"    {len(paginas)} paginas")
    return paginas


def union(categorias):
    total = {}
    for c in categorias:
        total.update(paginas_de_categoria(c))
    return total


def paginas_forzadas(titulos):
    """Devuelve {titulo_real: tamano} siguiendo redirecciones; avisa si alguno no existe."""
    encontradas = {}
    for i in range(0, len(titulos), 50):
        data = llamar_api({
            "action": "query",
            "titles": "|".join(titulos[i:i + 50]),
            "prop": "info",
            "redirects": "1",
        })
        q = data.get("query", {})
        for r in q.get("redirects", []):
            print(f"  '{r['from']}' redirige a '{r['to']}'")
        for p in q.get("pages", []):
            if p.get("missing"):
                print(f"  AVISO: '{p['title']}' no existe en el wiki")
            else:
                encontradas[p["title"]] = p.get("length", 0)
        time.sleep(PAUSA_SEG)
    return encontradas


def parentesis_valido(titulo):
    m = re.search(r"\(([^)]*)\)\s*$", titulo)
    return m is None or m.group(1) in PARENTESIS_PERMITIDOS


def chunks_estimados(bytes_wikitexto):
    limpio = bytes_wikitexto * FACTOR_LIMPIEZA
    paso = CHUNK_SIZE - CHUNK_OVERLAP
    return max(1, math.ceil((limpio - CHUNK_OVERLAP) / paso))


def main():
    print("1/4 Universo principal")
    principal = union(UNIVERSO_PRINCIPAL)
    print("2/4 Categorias de relevancia")
    relevantes = union(RELEVANCIA)
    print("3/4 Categorias del mundo")
    mundo = union(MUNDO)
    print("4/4 Categorias excluidas")
    excluir = set(union(EXCLUIR))

    def valido(t):
        return t not in excluir and "/" not in t and not t.startswith(EXCLUIR_PREFIJOS)

    personajes = {t: n for t, n in principal.items() if t in relevantes and valido(t)}
    mundo = {t: n for t, n in mundo.items()
             if t not in personajes and valido(t) and parentesis_valido(t)}
    grupos = {"personajes": personajes, "mundo": mundo}

    print("Paginas forzadas (INCLUIR_SIEMPRE)")
    ya_incluidas = set(personajes) | set(mundo)
    grupos["forzadas"] = {t: n for t, n in paginas_forzadas(INCLUIR_SIEMPRE).items()
                          if t not in ya_incluidas}
    print(f"  {len(grupos['forzadas'])} paginas nuevas agregadas")

    print("\nEstimacion por tamano minimo de pagina (bytes de wikitexto):\n")
    print(f"{'umbral':>8} | {'grupo':<11} | {'paginas':>8} | {'chunks aprox':>12}")
    print("-" * 50)
    for u in UMBRALES:
        tot_p = tot_c = 0
        for nombre, d in grupos.items():
            sel = [n for n in d.values() if n >= u]
            c = sum(chunks_estimados(n) for n in sel)
            tot_p += len(sel)
            tot_c += c
            print(f"{u:>8} | {nombre:<11} | {len(sel):>8} | {c:>12}")
        print(f"{u:>8} | {'TOTAL':<11} | {tot_p:>8} | {tot_c:>12}")
        print("-" * 50)

    elegidos = sorted(
        ((t, g, n) for g, d in grupos.items() for t, n in d.items() if n >= UMBRAL_ELEGIDO[g]),
        key=lambda x: (x[1], -x[2]),
    )
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SEED_TITLES.write_text("".join(t + "\n" for t, _, _ in elegidos), encoding="utf-8")
    with open(DATA_DIR / "seleccion_resumen.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["titulo", "grupo", "bytes", "chunks_estimados"])
        w.writerows((t, g, n, chunks_estimados(n)) for t, g, n in elegidos)

    total_chunks = sum(chunks_estimados(n) for _, _, n in elegidos)
    print(f"\nUmbrales elegidos: {UMBRAL_ELEGIDO}")
    print(f"-> {len(elegidos)} paginas, ~{total_chunks} chunks")
    print(f"Escritos: {SEED_TITLES} y {DATA_DIR / 'seleccion_resumen.csv'}")


if __name__ == "__main__":
    main()