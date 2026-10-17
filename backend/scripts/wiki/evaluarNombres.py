"""
Mide si el agente encuentra el documento correcto cuando la pregunta trae
nombres propios (en espanol, mal escritos o en ingles).

Corre solo rewrite_query + retrieve del grafo (sin grade_context ni generate),
asi que es rapido: una llamada al LLM por pregunta. Por cada pregunta del banco
(tests/datos/preguntas_nombres.csv) reporta la consulta reescrita, las
entidades y pistas que uso, si el documento esperado quedo en el top-k, su
mejor similitud y si pasaria el umbral y el criterio strong_retrieval.

Columnas del banco:
    grupo            tipo de caso (alias_es, nombre_igual, error_escritura, ...)
    pregunta         lo que escribe el usuario
    titulo_esperado  titulo(s) en la base, separados por "|" (cualquiera vale);
                     vacio en las preguntas fuera de dominio
    turno_previo     pregunta anterior de la conversacion (seguimientos)

Sirve para comparar antes y despues de un cambio con el mismo banco.
--sin-nombres apaga el indice de nombres y las pistas del glosario.

Requiere db y ollama levantados. Uso, desde backend/:
    uv run python .\\scripts\\wiki\\evaluarNombres.py
    uv run python .\\scripts\\wiki\\evaluarNombres.py --sin-nombres
    uv run python .\\scripts\\wiki\\evaluarNombres.py --csv ..\\data\\evaluacion_despues.csv
"""

import argparse
import csv
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND))

from app.agent.llm import crear_llm
from app.agent.nodos import Dependencias, crear_nodos, similitud_fuerte
from app.core.config import settings
from app.db.connection import get_connection
from app.services.retrieval import buscar

BANCO = BACKEND / "tests" / "datos" / "preguntas_nombres.csv"


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
        "entidades": ";".join(e.nombre_en for e in estado.get("entidades", [])),
        "pistas": ";".join(f"{es}->{en}" for es, en in estado.get("pistas", [])),
        "fuera_dominio": not esperados,
        "acierto": bool(sims_esperado),
        "sim_esperado": max(sims_esperado, default=0.0),
        "sim_top1": recuperados[0].similitud if recuperados else 0.0,
        "top1": recuperados[0].titulo if recuperados else "",
        "pasa_umbral": bool(relevantes),
        "strong": similitud_fuerte([r.similitud for r in relevantes]),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sin-nombres", action="store_true",
                        help="apaga el indice de nombres y las pistas del glosario")
    parser.add_argument("--csv", help="guarda el detalle en este archivo")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if args.sin_nombres and hasattr(settings, "usar_nombres"):
        settings.usar_nombres = False

    with BANCO.open(encoding="utf-8", newline="") as f:
        banco = list(csv.DictReader(f))

    resultados = []
    with get_connection() as conn:
        nodos = crear_nodos(Dependencias(
            llm=crear_llm(),
            buscar=lambda consulta, k: buscar(conn, consulta, k),
            guardar=lambda estado: 0,
        ))
        for fila in banco:
            r = evaluar_pregunta(nodos, fila)
            resultados.append(r)
            marca = "n/a" if r["fuera_dominio"] else ("SI " if r["acierto"] else "NO ")
            print(f"{marca} esp={r['sim_esperado']:.3f} top1={r['sim_top1']:.3f} "
                  f"umbral={'si' if r['pasa_umbral'] else 'no'} strong={'si' if r['strong'] else 'no'}"
                  f" | {r['pregunta']}\n      consulta: {r['consulta']}"
                  f"\n      entidades: {r['entidades'] or '-'} | pistas: {r['pistas'] or '-'}"
                  f" | top1: {r['top1']}", flush=True)

    con_esperado = [r for r in resultados if not r["fuera_dominio"]]
    aciertos = sum(r["acierto"] for r in con_esperado)
    print(f"\nAciertos en el top-{settings.retrieval_top_k}: {aciertos}/{len(con_esperado)}")
    fuera = [r for r in resultados if r["fuera_dominio"]]
    for r in fuera:
        print(f"Fuera de dominio: {r['pregunta']} -> top1={r['sim_top1']:.3f} "
              f"strong={'si' if r['strong'] else 'no'} entidades={r['entidades'] or '-'}")

    if args.csv:
        with open(args.csv, "w", encoding="utf-8", newline="") as f:
            escritor = csv.DictWriter(f, fieldnames=list(resultados[0]))
            escritor.writeheader()
            escritor.writerows(resultados)
        print(f"Detalle guardado en {args.csv}")


if __name__ == "__main__":
    main()
