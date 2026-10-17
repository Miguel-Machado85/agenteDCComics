"""
Mide como responde el agente a preguntas con nombres propios (en espanol, mal
escritos o en ingles) y a preguntas fuera de dominio.

Dos modos:
- Por defecto corre solo rewrite_query + retrieve (una llamada al LLM por
  pregunta) y reporta si el documento esperado quedo en el top-k, su mejor
  similitud y si pasaria el umbral y strong_retrieval.
- --completo corre el grafo entero con un `guardar` falso (no escribe en el
  historial) y reporta en que etapa termino cada pregunta: busqueda (nada sobre
  el umbral), grade_context (no suficiente), generate (el modelo devolvio el
  marcador) o respondida; ademas la respuesta cruda del LLM y el tiempo.

Columnas del banco (tests/datos/preguntas_nombres.csv):
    grupo            tipo de caso (alias_es, nombre_igual, medio, fuera_dominio...)
    pregunta         lo que escribe el usuario
    titulo_esperado  titulo(s) en la base, separados por "|" (cualquiera vale);
                     vacio en las preguntas fuera de dominio. "zorvax" es un
                     documento de prueba que el script sube y borra al terminar
    turno_previo     pregunta anterior de la conversacion (seguimientos)
    palabras_clave   palabras (separadas por "|") de las que debe aparecer alguna
                     en la respuesta para darla por correcta (solo --completo)

Sirve para comparar antes y despues de un cambio con el mismo banco.

Requiere db y ollama levantados. Uso, desde backend/:
    uv run python .\\scripts\\wiki\\evaluarNombres.py
    uv run python .\\scripts\\wiki\\evaluarNombres.py --completo --etiqueta base
    uv run python .\\scripts\\wiki\\evaluarNombres.py --csv ..\\data\\evaluacion_despues.csv
"""

import argparse
import csv
import json
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND))

from app.agent.grafo import construir_grafo
from app.agent.llm import crear_llm
from app.agent.nodos import Dependencias, crear_nodos, similitud_fuerte
from app.core.config import settings
from app.db.connection import get_connection
from app.services.ingestion import Documento, Seccion, ingestar
from app.services.retrieval import buscar

BANCO = BACKEND / "tests" / "datos" / "preguntas_nombres.csv"
DATA = BACKEND.parent / "data"

DOC_PRUEBA = Documento(
    source="upload",
    source_id="evaluacion-zorvax",
    title="zorvax",
    uploaded_by="evaluacion",
    secciones=[
        Seccion("Zorvax", "Zorvax the Lumen-Keeper is the guardian of the Crystal Orchard of Vethra."),
        Seccion("Weakness", "Zorvax is weakened by cold copper. Touching cold copper makes him "
                            "lose his light for three hours."),
    ],
)


def evaluar_pregunta(nodos: dict, fila: dict) -> dict:
    estado = {"pregunta": fila["pregunta"], "historial": []}
    if fila["turno_previo"]:
        estado["historial"] = [{"pregunta": fila["turno_previo"], "respuesta": "(answered)"}]
    estado.update(nodos["rewrite_query"](estado))
    estado.update(nodos["retrieve"](estado))

    esperados = {t for t in fila["titulo_esperado"].split("|") if t}
    recuperados = estado["recuperados"]
    sims_esperado = [r.similitud for r in recuperados if r.titulo in esperados]
    relevantes = estado["relevantes"]
    return {
        "grupo": fila["grupo"],
        "pregunta": fila["pregunta"],
        "consulta": estado["consulta"],
        "fuera_dominio": not esperados,
        "acierto": bool(sims_esperado),
        "sim_esperado": max(sims_esperado, default=0.0),
        "sim_top1": recuperados[0].similitud if recuperados else 0.0,
        "top1": recuperados[0].titulo if recuperados else "",
        "pasa_umbral": bool(relevantes),
        "strong": similitud_fuerte([r.similitud for r in relevantes]),
    }


def etapa_final(final: dict) -> str:
    if final.get("decision") in ("saludo", "ambigua"):
        return final["decision"]
    if not final["relevantes"]:
        return "busqueda"
    if not final["suficiente"]:
        return "grade_context"
    return "generate" if final["rechazada"] else "respondida"


def evaluar_completo(grafo, fila: dict) -> dict:
    estado = {"pregunta": fila["pregunta"], "usuario_sub": "evaluacion", "username": "evaluacion",
              "historial": []}
    if fila["turno_previo"]:
        estado["historial"] = [{"pregunta": fila["turno_previo"], "respuesta": "(answered)"}]
    t0 = time.perf_counter()
    final = grafo.invoke(estado)
    segundos = time.perf_counter() - t0

    esperados = {t for t in fila["titulo_esperado"].split("|") if t}
    claves = [k.lower() for k in fila["palabras_clave"].split("|") if k]
    etapa = etapa_final(final)
    recuperados = final.get("recuperados", [])
    usados = final.get("relevantes", [])[: settings.max_chunks_prompt]
    texto = final["respuesta"].lower()
    return {
        "grupo": fila["grupo"],
        "pregunta": fila["pregunta"],
        "consulta": final.get("consulta", ""),
        "fuera_dominio": not esperados,
        "etapa": etapa,
        "sim_top1": recuperados[0].similitud if recuperados else 0.0,
        "model_sufficient": final.get("model_sufficient"),
        "strong": final.get("strong_retrieval"),
        "segundos": round(segundos, 1),
        "correcta": etapa == "respondida" and (not claves or any(k in texto for k in claves)),
        "respuesta_cruda": final.get("respuesta_cruda", ""),
        "respuesta": final["respuesta"],
        "chunks_usados": [{"titulo": r.titulo, "seccion": r.seccion, "similitud": round(r.similitud, 3),
                           "contenido": r.contenido} for r in usados],
    }


def resumen_completo(resultados: list[dict]) -> None:
    dominio = [r for r in resultados if not r["fuera_dominio"]]
    fuera = [r for r in resultados if r["fuera_dominio"]]
    print(f"\nEn dominio: {len(dominio)} preguntas")
    print(f"  respondidas correctamente: {sum(r['correcta'] for r in dominio)}")
    print(f"  respondidas con respuesta incorrecta: "
          f"{sum(r['etapa'] == 'respondida' and not r['correcta'] for r in dominio)}")
    for etapa in ("busqueda", "grade_context", "generate", "saludo", "ambigua"):
        print(f"  rechazadas/terminadas en {etapa}: {sum(r['etapa'] == etapa for r in dominio)}")
    print(f"Fuera de dominio: {len(fuera)} preguntas")
    print(f"  rechazadas: {sum(r['etapa'] in ('busqueda', 'grade_context', 'generate') for r in fuera)}"
          f" (busqueda {sum(r['etapa'] == 'busqueda' for r in fuera)}, grade_context "
          f"{sum(r['etapa'] == 'grade_context' for r in fuera)}, generate "
          f"{sum(r['etapa'] == 'generate' for r in fuera)})")
    print(f"  respondidas (error): {sum(r['etapa'] == 'respondida' for r in fuera)}")
    print(f"Tiempo promedio por pregunta: {sum(r['segundos'] for r in resultados) / len(resultados):.1f} s")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--completo", action="store_true",
                        help="corre el grafo entero (sin guardar historial)")
    parser.add_argument("--etiqueta", default="base",
                        help="nombre del detalle JSON de --completo (data/evaluacion_completo_<etiqueta>.json)")
    parser.add_argument("--csv", help="guarda el detalle del modo rapido en este archivo")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    with BANCO.open(encoding="utf-8", newline="") as f:
        banco = list(csv.DictReader(f))

    resultados = []
    with get_connection() as conn:
        dependencias = Dependencias(
            llm=crear_llm(),
            llm_json=crear_llm(modo_json=True),
            buscar=lambda consulta, k: buscar(conn, consulta, k),
            guardar=lambda estado: 0,
        )
        nodos = crear_nodos(dependencias)
        grafo = construir_grafo(dependencias) if args.completo else None
        usa_doc = any(f["titulo_esperado"] == "zorvax" for f in banco)
        try:
            if usa_doc:
                ingestar(conn, [DOC_PRUEBA])
            for fila in banco:
                if args.completo:
                    r = evaluar_completo(grafo, fila)
                    resultados.append(r)
                    marca = ("ok " if r["correcta"] else "MAL") if not r["fuera_dominio"] else (
                        "rech" if r["etapa"] != "respondida" else "RESP")
                    print(f"{marca} {r['etapa']:<13} top1={r['sim_top1']:.3f} "
                          f"modelo={r['model_sufficient']} strong={r['strong']} {r['segundos']:>5}s"
                          f" | {r['pregunta']}\n      consulta: {r['consulta']}", flush=True)
                else:
                    r = evaluar_pregunta(nodos, fila)
                    resultados.append(r)
                    marca = "n/a" if r["fuera_dominio"] else ("SI " if r["acierto"] else "NO ")
                    print(f"{marca} esp={r['sim_esperado']:.3f} top1={r['sim_top1']:.3f} "
                          f"umbral={'si' if r['pasa_umbral'] else 'no'} strong={'si' if r['strong'] else 'no'}"
                          f" | {r['pregunta']}\n      consulta: {r['consulta']} | top1: {r['top1']}",
                          flush=True)
        finally:
            if usa_doc:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM documents WHERE source = 'upload' AND source_id = %s",
                                (DOC_PRUEBA.source_id,))
                conn.commit()

    if args.completo:
        resumen_completo(resultados)
        destino = DATA / f"evaluacion_completo_{args.etiqueta}.json"
        destino.write_text(json.dumps(resultados, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"Detalle guardado en {destino}")
    else:
        con_esperado = [r for r in resultados if not r["fuera_dominio"]]
        print(f"\nAciertos en el top-{settings.retrieval_top_k}: "
              f"{sum(r['acierto'] for r in con_esperado)}/{len(con_esperado)}")
        if args.csv:
            with open(args.csv, "w", encoding="utf-8", newline="") as f:
                escritor = csv.DictWriter(f, fieldnames=list(resultados[0]))
                escritor.writeheader()
                escritor.writerows(resultados)
            print(f"Detalle guardado en {args.csv}")


if __name__ == "__main__":
    main()
