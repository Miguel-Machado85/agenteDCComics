"""
Paso 3: convierte el wikitexto de data/raw/ en texto limpio, estructurado por
secciones, y lo guarda en data/clean/ (un archivo por cada lote de raw/).

Cada linea de salida es una pagina:
    {
      "pageid", "title", "url", "revid", "timestamp", "categories",
      "tipo":      "character" | "team" | "location" | ... | "other",
      "nombre":    "Superman",                       # nombre para mostrar
      "alias":     ["Superman", "Kal-El", "Clark Joseph Kent", ...],
      "secciones": [{"seccion": "Profile", "texto": "Real Name: ..."},
                    {"seccion": "History > Early Life", "texto": "..."}, ...]
    }

Que hace con cada pagina:
- Busca la plantilla principal ({{DC Database:Character Template ...}}, Team,
  Location, Event...). Sus campos cortos (nombre real, afiliacion, primera
  aparicion...) forman la seccion "Profile"; los campos de texto (Overview,
  HistoryText, Powers, Notes...) y las listas largas (miembros, enemigos,
  familiares) se vuelven secciones propias. HistoryText se parte por sus
  subtitulos (=== Early Life ===).
- Quita referencias <ref>, citas {{c|...}}, imagenes, galerias, tablas,
  plantillas de mantenimiento y comentarios. Los enlaces [[A|B]] quedan como B.
- Paginas sin plantilla principal: se parten por sus encabezados == X ==.

Se puede correr las veces que haga falta: regenera data/clean/ completo.
Al final imprime un resumen con chunks estimados y las plantillas desconocidas
mas frecuentes (para afinar las reglas de abajo si hace falta).

Requiere mwparserfromhell (dependencia de desarrollo):
    uv add --dev mwparserfromhell
Uso, desde backend/:
    uv run python .\limpiarTexto.py
    uv run python .\limpiarTexto.py --muestra "Aquaman (Arthur Curry)"
"""

import argparse
import collections
import html
import json
import math
import re
import sys

import mwparserfromhell as mw
from mwparserfromhell.nodes import (
    Comment, ExternalLink, Heading, HTMLEntity, Tag, Template, Text, Wikilink,
)

from comun import DATA_DIR, RAW_DIR

CLEAN_DIR = DATA_DIR / "clean"

# ---------------------------------------------------------------------------
# Reglas (edita aqui)
# ---------------------------------------------------------------------------

# Campos de la plantilla principal que se descartan
CAMPOS_IGNORADOS = {
    "image", "imagesize", "imagetext", "pagetitle", "quotation", "speaker",
    "quotesource", "links", "dc", "wikipedia", "recommended",
    "recommendedreading", "othermedia", "heightref", "weightref", "issues",
    "collected", "titles", "notesheader", "historyheader", "customlabel",
    "distreg", "galleries",
}
CAMPOS_IGNORADOS_PREFIJO = ("distinguish", "customsection", "image")

# Campos que siempre son seccion propia (texto o listas largas)
CAMPOS_SECCION = [
    "overview", "historytext", "history", "origin", "personality", "powers",
    "abilities", "weaknesses", "equipment", "transportation", "weapons",
    "other", "currentmembers", "formermembers", "teamleaders",
    "organizationleaders", "allies", "enemies", "relatives", "heroes",
    "villains", "others", "residents", "representatives", "pointsofinterest",
    "culturaltraits", "custom", "customtext1", "customtext2", "customtext3",
    "notes", "trivia",
]
# Cualquier otro campo con mas texto que esto tambien pasa a seccion propia
MAX_CARACTERES_FICHA = 250

# Nombres legibles para algunas secciones (el resto se deriva del campo)
NOMBRES_CAMPO = {
    "historytext": "History",
    "currentmembers": "Current Members",
    "formermembers": "Former Members",
    "teamleaders": "Team Leaders",
    "organizationleaders": "Leaders",
    "pointsofinterest": "Points of Interest",
    "baseofoperations": "Base of Operations",
    "realname": "Real Name",
    "mainalias": "Main Alias",
    "maritalstatus": "Marital Status",
    "first": "First Appearance",
    "last": "Last Appearance",
    "officialname": "Official Name",
    "customtext1": "Other Information",
    "customtext2": "Other Information",
    "customtext3": "Other Information",
}

# Campos de donde se sacan los alias (en este orden)
CAMPOS_ALIAS = ["mainalias", "realname", "officialname", "name", "aliases"]
MAX_ALIAS = 10

# Plantillas internas que se eliminan por completo (en minusculas)
PLANTILLAS_ELIMINAR = {
    "c", "cite", "cite web", "cite book", "cite news", "citation",
    "citation needed", "cn", "image", "main", "expand", "incomplete", "noinfo",
    "stub", "peboilerplate", "quote", "cleanup", "clean up", "update",
    "copy edit", "reflist", "clear", "toc", "spoiler", "disambig", "dablink",
    "for", "see also", "gallery", "nav", "pethings", "pething",
}
# Plantillas que se reemplazan por su ultimo argumento ({{WP|Panopticon}})
PLANTILLAS_ARGUMENTO = {"a", "wp", "v", "tve", "green", "red", "blue", "w", "nowrap", "small"}
# Plantillas que se eliminan si su nombre empieza asi (avisos de continuidad)
PLANTILLAS_ELIMINAR_PREFIJO = ("dc database:", "cite", "multicont")

MIN_CARACTERES_SECCION = 40  # secciones mas cortas se descartan

# Para estimar chunks (mismos valores que usara la ingesta)
CHUNK_SIZE, CHUNK_OVERLAP = 900, 150

# ---------------------------------------------------------------------------

plantillas_desconocidas = collections.Counter()


def nombre_legible(campo):
    clave = campo.lower()
    if clave in NOMBRES_CAMPO:
        return NOMBRES_CAMPO[clave]
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", campo).strip()  # MaritalStatus -> Marital Status


def args_posicionales(t):
    return [p.value for p in t.params if not p.showkey]


def render_plantilla(t, titulo):
    nombre = str(t.name).strip()
    clave = nombre.lower()
    if clave in PLANTILLAS_ELIMINAR or clave.startswith(PLANTILLAS_ELIMINAR_PREFIJO):
        return ""
    if clave in ("pagename", "pagenamee"):
        return titulo
    args = args_posicionales(t)
    if clave in PLANTILLAS_ARGUMENTO:
        return render(args[-1], titulo) if args else ""
    if clave == "navigation":  # cajas con titulo y cuerpo de texto
        partes = [render(t.get(k).value, titulo) for k in ("title", "body") if t.has(k)]
        return "\n" + ": ".join(p for p in partes if p) + "\n"
    if clave == "vulnerability to" and args:
        return "Vulnerability to " + render(args[0], titulo)

    # Plantillas de poderes y similares: {{Genius Level Intellect}},
    # {{Energy Absorption|Solar Radiation Absorption}}
    plantillas_desconocidas[nombre] += 1
    if not args:
        return nombre
    arg = render(args[0], titulo).strip()
    if not arg or arg.lower() in nombre.lower() or nombre.lower() in arg.lower():
        return arg or nombre
    return f"{nombre} ({arg})"


def render(codigo, titulo):
    """Convierte un fragmento de wikitexto (Wikicode) a texto plano."""
    salida = []
    for n in codigo.nodes:
        if isinstance(n, Text):
            salida.append(str(n))
        elif isinstance(n, Wikilink):
            destino = str(n.title).strip()
            if re.match(r"^:?\s*(file|image|category|media)\s*:", destino, re.I):
                continue
            if n.text is not None:
                salida.append(render(n.text, titulo))
            else:
                salida.append(destino.split("#")[0].lstrip(":"))
        elif isinstance(n, Template):
            salida.append(render_plantilla(n, titulo))
        elif isinstance(n, Tag):
            tag = str(n.tag).lower()
            marca = n.wiki_markup
            if tag in ("ref", "gallery", "table", "references", "math", "timeline", "imagemap"):
                continue
            if tag == "br":
                salida.append("\n")
            elif tag == "li" and marca:  # "*", "**" al inicio de linea
                salida.append("- ")
            elif tag == "dt" and marca:
                salida.append("")
            elif tag == "dd" and marca:  # ":" de sangria
                salida.append("  ")
            elif tag == "hr":
                salida.append("\n")
            elif n.contents is not None:
                salida.append(render(n.contents, titulo))
        elif isinstance(n, HTMLEntity):
            salida.append(n.normalize())
        elif isinstance(n, ExternalLink):
            if n.title is not None:
                salida.append(render(n.title, titulo))
        elif isinstance(n, Heading):
            salida.append("\n" + render(n.title, titulo).strip() + "\n")
        elif isinstance(n, Comment):
            continue
        # Argument, Wikicode residual: se ignoran
    return "".join(salida)


def normalizar(texto):
    texto = html.unescape(texto).replace(" ", " ")
    texto = re.sub(r"'{2,}", "", texto)                    # cursivas/negritas sueltas
    texto = re.sub(r"</?[a-zA-Z][^>\n]*>", "", texto)      # etiquetas HTML sin cerrar
    texto = re.sub(r"^\s*(={2,6})\s*(.+?)\s*\1\s*$", r"\2:", texto, flags=re.M)  # ===X=== -> X:
    texto = re.sub(r"__[A-Z]+__", "", texto)               # __NOTOC__ y similares
    texto = re.sub(r"\(\s*[,;]?\s*\)", "", texto)          # parentesis vacios
    texto = re.sub(r"[ \t]+", " ", texto)
    texto = re.sub(r" +([,.;:!?])", r"\1", texto)
    texto = re.sub(r"^[ \t]*(?:[*#]+|(?:- )+)[ \t]*", "- ", texto, flags=re.M)  # viñetas: "- - -", "**" -> "- "
    lineas = [l.strip().rstrip(",;").strip() for l in texto.split("\n")]
    lineas = [l for l in lineas if l and l not in ("-", ":", ";", ",")]
    texto = "\n".join(lineas)
    return texto.strip(" ,;\n")


def limpiar(codigo, titulo):
    return normalizar(render(codigo, titulo))


ENCABEZADO = re.compile(r"^(={2,6})\s*(.+?)\s*\1\s*$", re.M)


def parsear(wikitexto):
    # skip_style_tags: las cursivas '' sin cerrar (muy comunes en el wiki)
    # no deben "tragarse" el resto de la plantilla
    return mw.parse(wikitexto, skip_style_tags=True)


def partir_por_encabezados(wikitexto, raiz, titulo):
    """Divide wikitexto por sus encabezados (== X ==); devuelve [(ruta, texto)].

    Se hace con regex sobre el texto, porque el parser no reconoce encabezados
    dentro de los campos de una plantilla.
    """
    resultado = []
    pila = []  # [(nivel, nombre)]
    marcas = list(ENCABEZADO.finditer(wikitexto))
    cortes = [(None, 0)] + [(m, m.end()) for m in marcas]
    for i, (m, inicio) in enumerate(cortes):
        fin = marcas[i].start() if i < len(marcas) else len(wikitexto)
        if m is not None:
            nivel = len(m.group(1))
            nombre = limpiar(parsear(m.group(2)), titulo)
            while pila and pila[-1][0] >= nivel:
                pila.pop()
            pila.append((nivel, nombre))
        partes = ([raiz] if raiz else []) + [n for _, n in pila]
        ruta = " > ".join(p for p in partes if p) or "Overview"
        resultado.append((ruta, limpiar(parsear(wikitexto[inicio:fin]), titulo)))
    return resultado


def extraer_alias(campos, titulo):
    candidatos = []
    for clave in CAMPOS_ALIAS:
        if clave in campos:
            candidatos += re.split(r"[\n;]", campos[clave])
    base = re.sub(r"\s*\([^)]*\)\s*$", "", titulo)       # "Orin (New Earth)" -> "Orin"
    m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", titulo)    # "Batman (Bruce Wayne)"
    candidatos += [base] + ([m.group(2)] if m and m.group(2) not in ("New Earth", "Prime Earth") else [])

    alias, vistos = [], set()
    for c in candidatos:
        c = re.sub(r"\([^)]*\)", "", c)                  # "(Birth Name)", "(See Notes)"
        c = c.strip(" ,;.-*'\"")
        if not c or len(c) > 60 or c.lower().startswith(("see ", "formerly", "and ")):
            continue
        if c.lower() not in vistos:
            vistos.add(c.lower())
            alias.append(c)
    return alias[:MAX_ALIAS]


def prelimpiar(wikitexto):
    """Quita con regex lo que suele romper el parser (refs mal cerradas, etc.)."""
    w = re.sub(r"<!--.*?-->", "", wikitexto, flags=re.S)
    w = re.sub(r"<ref\b[^>]*/\s*>", "", w, flags=re.I)
    w = re.sub(r"<ref\b[^>]*>.*?</ref\s*>", "", w, flags=re.I | re.S)
    w = re.sub(r"<gallery\b[^>]*>.*?</gallery\s*>", "", w, flags=re.I | re.S)
    w = re.sub(r"<references\s*/?>", "", w, flags=re.I)
    return w


def plantilla_principal(codigo):
    for t in codigo.filter_templates(recursive=False):
        if str(t.name).strip().lower().startswith("dc database:") and "template" in str(t.name).lower():
            return t
    return None


def procesar_pagina(p):
    titulo = p["title"]
    codigo = parsear(prelimpiar(p["wikitext"]))
    principal = plantilla_principal(codigo)

    secciones = []
    campos_cortos = {}  # para alias y ficha
    if principal is None:
        tipo = "other"
        for ruta, texto in partir_por_encabezados(str(codigo), "", titulo):
            secciones.append({"seccion": ruta, "texto": texto})
        nombre = re.sub(r"\s*\([^)]*\)\s*$", "", titulo)
    else:
        tipo = re.sub(r"(?i)^dc database:\s*|\s*template$", "", str(principal.name).strip()).lower()
        ficha = []
        orden = {c: i for i, c in enumerate(CAMPOS_SECCION)}
        largas = []
        for param in principal.params:
            campo = str(param.name).strip()
            clave = campo.lower()
            if clave in CAMPOS_IGNORADOS or clave.startswith(CAMPOS_IGNORADOS_PREFIJO):
                continue
            if clave in ("historytext", "history"):
                for ruta, texto in partir_por_encabezados(str(param.value), "History", titulo):
                    largas.append((orden.get(clave, 50), ruta, texto))
                continue
            texto = limpiar(param.value, titulo)
            if not texto:
                continue
            if clave in CAMPOS_ALIAS:
                campos_cortos[clave] = texto
            if clave in orden or len(texto) > MAX_CARACTERES_FICHA:
                largas.append((orden.get(clave, 40), nombre_legible(campo), texto))
            else:
                valores = [v.strip(" ,;") for v in re.split(r"[\n;]", texto)]
                ficha.append(f"{nombre_legible(campo)}: " + "; ".join(v for v in valores if v))
        if ficha:
            secciones.append({"seccion": "Profile", "texto": "\n".join(ficha)})
        for _, ruta, texto in sorted(largas, key=lambda x: x[0]):  # sort estable
            secciones.append({"seccion": ruta, "texto": texto})
        nombre = (campos_cortos.get("mainalias") or campos_cortos.get("officialname")
                  or campos_cortos.get("name") or re.sub(r"\s*\([^)]*\)\s*$", "", titulo))
        nombre = re.split(r"[\n;]", nombre)[0].strip()

    secciones = [s for s in secciones if len(s["texto"]) >= MIN_CARACTERES_SECCION]
    return {
        "pageid": p["pageid"],
        "title": titulo,
        "url": p["url"],
        "revid": p["revid"],
        "timestamp": p["timestamp"],
        "categories": p["categories"],
        "tipo": tipo,
        "nombre": nombre,
        "alias": extraer_alias(campos_cortos, titulo),
        "secciones": secciones,
    }


def chunks_estimados(texto):
    paso = CHUNK_SIZE - CHUNK_OVERLAP
    return max(1, math.ceil((len(texto) - CHUNK_OVERLAP) / paso))


def chunks_agrupados(secciones):
    """Estimacion realista: junta secciones cortas consecutivas en un mismo chunk,
    como hara la ingesta."""
    total, buffer = 0, 0
    for s in secciones:
        n = len(s["texto"])
        if n > CHUNK_SIZE:
            total += (1 if buffer else 0) + chunks_estimados(s["texto"])
            buffer = 0
        elif buffer + n <= CHUNK_SIZE:
            buffer += n
        else:
            total += 1
            buffer = n
    return total + (1 if buffer else 0)


def mostrar_muestra(titulo):
    for ruta in sorted(RAW_DIR.glob("lote_*.jsonl")):
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                p = json.loads(linea)
                if p["title"] == titulo:
                    r = procesar_pagina(p)
                    print(f"# {r['title']}  [{r['tipo']}]  nombre={r['nombre']!r}")
                    print(f"alias: {r['alias']}\n")
                    for s in r["secciones"]:
                        print(f"## {s['seccion']}  ({len(s['texto'])} car.)")
                        print(s["texto"][:700] + (" [...]" if len(s["texto"]) > 700 else ""))
                        print()
                    return
    print(f"No encontre '{titulo}' en {RAW_DIR}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--muestra", help="imprime como queda una pagina y termina")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # consola de Windows
    if args.muestra:
        mostrar_muestra(args.muestra)
        return

    CLEAN_DIR.mkdir(parents=True, exist_ok=True)
    for viejo in CLEAN_DIR.glob("lote_*.jsonl"):
        viejo.unlink()

    paginas = secciones = caracteres = chunks = agrupados = 0
    por_tipo = collections.Counter()
    vacias = []
    lotes = sorted(RAW_DIR.glob("lote_*.jsonl"))
    for i, ruta in enumerate(lotes, start=1):
        salida = []
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                r = procesar_pagina(json.loads(linea))
                if not r["secciones"]:
                    vacias.append(r["title"])
                    continue
                salida.append(r)
                paginas += 1
                por_tipo[r["tipo"]] += 1
                secciones += len(r["secciones"])
                agrupados += chunks_agrupados(r["secciones"])
                for s in r["secciones"]:
                    caracteres += len(s["texto"])
                    chunks += chunks_estimados(s["texto"])
        with open(CLEAN_DIR / ruta.name, "w", encoding="utf-8") as f:
            for r in salida:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        if i % 20 == 0 or i == len(lotes):
            print(f"{i}/{len(lotes)} lotes procesados")

    print(f"\nListo: {paginas} paginas, {secciones} secciones, "
          f"{caracteres / 1e6:.1f} M caracteres")
    print(f"Chunks estimados: ~{chunks} sin agrupar secciones; ~{agrupados} agrupando secciones cortas")
    print("Por tipo:", dict(por_tipo.most_common()))
    if vacias:
        print(f"{len(vacias)} paginas quedaron sin texto util (descartadas), p. ej.: {vacias[:5]}")
    print("\nPlantillas desconocidas mas frecuentes (se dejaron como texto):")
    for nombre, n in plantillas_desconocidas.most_common(25):
        print(f"  {n:>6}  {nombre}")


if __name__ == "__main__":
    main()