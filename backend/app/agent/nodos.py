"""
Nodos del grafo del agente.

`crear_nodos` recibe sus dependencias (LLM, funcion de busqueda, funcion de
guardado) en vez de importarlas: asi el grafo se prueba con dobles, sin
Ollama ni Postgres. Cada nodo recibe el estado y devuelve solo las claves
que cambia.

Decisiones que conviene recordar:
- validate_intent NO decide si la pregunta es "de DC": un 3B da falsos
  rechazos. Eso lo deciden el umbral de similitud y grade_context.
- grade_context combina el grader del LLM con un criterio de recuperacion
  fuerte (varios chunks muy parecidos), porque el grader de un 3B rechaza
  preguntas validas aunque la busqueda haya sido buena.
- Las fuentes las arma el codigo con los chunks usados, nunca el LLM.
"""

import json
import logging
import re
from collections.abc import Callable
from dataclasses import dataclass

from app.agent import prompts
from app.agent.estado import EstadoAgente
from app.core.config import settings
from app.services.glosario import traducir_alias
from app.services.idioma import parece_ingles
from app.services.retrieval import Resultado

log = logging.getLogger("agente")

INTENCIONES = ("pregunta", "saludo", "ambigua")
MAX_FRAGMENTO = 300           # caracteres del chunk que se devuelven como fuente
MAX_CHUNK_EVALUACION = 500    # caracteres por chunk que ve el grader
MAX_RESPUESTA_HISTORIAL = 300


@dataclass
class Dependencias:
    llm: object                                          # .invoke(str) -> texto o mensaje
    buscar: Callable[[str, int], list[Resultado]]        # (consulta, k) -> resultados
    guardar: Callable[[EstadoAgente], int]               # estado -> historial_id
    llm_json: object | None = None                       # LLM en modo JSON (opcional)


def _texto(respuesta) -> str:
    return (respuesta if isinstance(respuesta, str) else respuesta.content).strip()


def _json(texto: str) -> dict:
    """Extrae el primer objeto JSON del texto; {} si no hay uno valido."""
    m = re.search(r"\{.*\}", texto, re.DOTALL)
    if not m:
        return {}
    try:
        datos = json.loads(m.group(0))
    except json.JSONDecodeError:
        return {}
    return datos if isinstance(datos, dict) else {}


def _formato_historial(historial: list[dict]) -> str:
    if not historial:
        return "(empty)"
    return "\n".join(
        f"User: {t['pregunta']}\nAssistant: {t['respuesta'][:MAX_RESPUESTA_HISTORIAL]}"
        for t in historial
    )


def similitud_fuerte(similitudes: list[float]) -> bool:
    """Recuperacion fuerte: varios chunks muy parecidos (similitudes de mayor a menor)."""
    return (
        len(similitudes) >= settings.strong_min_chunks
        and similitudes[0] >= settings.strong_top1
        and sum(similitudes[:3]) / 3 >= settings.strong_top3_avg
    )


def _fuente(r: Resultado) -> dict:
    cuerpo = r.contenido.split("\n", 1)[-1]   # sin el encabezado "Titulo - Seccion"
    return {
        "document_id": r.document_id,
        "titulo": r.titulo,
        "url": r.url,
        "seccion": r.seccion,
        "similitud": round(r.similitud, 4),
        "fragmento": cuerpo[:MAX_FRAGMENTO],
    }


def crear_nodos(dep: Dependencias) -> dict[str, Callable]:
    llm_json = dep.llm_json or dep.llm

    def validate_intent(estado: EstadoAgente) -> dict:
        prompt = prompts.PROMPT_INTENCION.format(
            historial=_formato_historial(estado.get("historial", [])),
            pregunta=estado["pregunta"],
        )
        intencion = str(_json(_texto(llm_json.invoke(prompt))).get("intencion", "")).lower()
        if intencion not in INTENCIONES:
            intencion = "pregunta"   # ante la duda se busca; no se rechaza por intencion
        if intencion == "saludo":
            return {"intencion": intencion, "decision": "saludo", "rechazada": False,
                    "respuesta": prompts.MENSAJE_SALUDO, "fuentes": []}
        if intencion == "ambigua":
            return {"intencion": intencion, "decision": "ambigua", "rechazada": False,
                    "respuesta": prompts.MENSAJE_ACLARACION, "fuentes": []}
        return {"intencion": intencion}

    def rewrite_query(estado: EstadoAgente) -> dict:
        prompt = prompts.PROMPT_REESCRITURA.format(
            historial=_formato_historial(estado.get("historial", [])),
            pregunta=traducir_alias(estado["pregunta"]),   # el 3B no traduce alias de forma confiable
        )
        lineas = [ln.strip(" \"'") for ln in _texto(dep.llm.invoke(prompt)).splitlines()]
        consulta = next((ln for ln in lineas if ln), "") or estado["pregunta"]
        return {"consulta": traducir_alias(consulta)}

    def retrieve(estado: EstadoAgente) -> dict:
        k = settings.retrieval_top_k
        recuperados = dep.buscar(estado["consulta"], k)
        # E5 es multilingue: buscar tambien con la pregunta original sirve de red de
        # seguridad si la reescritura salio mal. Se une por chunk con la mejor similitud.
        if settings.search_original_question and estado["pregunta"].lower() != estado["consulta"].lower():
            mejores = {(r.document_id, r.contenido): r for r in recuperados}
            for r in dep.buscar(estado["pregunta"], k):
                clave = (r.document_id, r.contenido)
                if clave not in mejores or r.similitud > mejores[clave].similitud:
                    mejores[clave] = r
            recuperados = sorted(mejores.values(), key=lambda r: r.similitud, reverse=True)[:k]
        relevantes = [r for r in recuperados if r.similitud >= settings.similarity_threshold]
        return {"recuperados": recuperados, "relevantes": relevantes}

    def grade_context(estado: EstadoAgente) -> dict:
        relevantes = estado["relevantes"]
        if not relevantes:
            # Nada sobre el umbral: se rechaza sin gastar una llamada al LLM
            return {"model_sufficient": None, "strong_retrieval": False, "suficiente": False}
        usados = relevantes[: settings.max_chunks_prompt]
        contexto = "\n\n".join(
            f"[{i}] {r.contenido[:MAX_CHUNK_EVALUACION]}" for i, r in enumerate(usados, 1)
        )
        prompt = prompts.PROMPT_EVALUACION.format(
            pregunta=estado.get("consulta") or estado["pregunta"], contexto=contexto
        )
        veredicto = _json(_texto(llm_json.invoke(prompt))).get("suficiente")
        model_sufficient = veredicto is True or str(veredicto).lower() == "true"
        strong = similitud_fuerte([r.similitud for r in relevantes])
        return {
            "model_sufficient": model_sufficient,
            "strong_retrieval": strong,
            "suficiente": model_sufficient or strong,
        }

    def generate(estado: EstadoAgente) -> dict:
        usados = estado["relevantes"][: settings.max_chunks_prompt]
        contexto = "\n\n".join(f"[{i}] {r.contenido}" for i, r in enumerate(usados, 1))
        # El 3B es mucho mas fiable respondiendo en ingles sobre un contexto en ingles
        prompt = prompts.PROMPT_GENERACION.format(
            marcador=prompts.MARCADOR_SIN_INFO,
            contexto=contexto,
            pregunta=estado.get("consulta") or estado["pregunta"],
        )
        respuesta = cruda = _texto(dep.llm.invoke(prompt))
        if prompts.MARCADOR_SIN_INFO in respuesta or not respuesta:
            return {"respuesta": "", "respuesta_cruda": respuesta, "decision": "reject"}
        if settings.translate_answers and not parece_ingles(estado["pregunta"]):
            traducida = _texto(dep.llm.invoke(
                prompts.PROMPT_TRADUCCION.format(texto=respuesta)
            ))
            respuesta = traducida or respuesta   # si falla, se entrega en ingles
        return {
            "respuesta": respuesta,
            "respuesta_cruda": cruda,
            "rechazada": False,
            "decision": "generate",
            "fuentes": [_fuente(r) for r in usados],
        }

    def reject(estado: EstadoAgente) -> dict:
        return {
            "respuesta": f"{prompts.MENSAJE_RECHAZO}\n\n{prompts.SUGERENCIA_DOCUMENTOS}",
            "rechazada": True,
            "decision": "reject",
            "fuentes": [],
        }

    def save_history(estado: EstadoAgente) -> dict:
        recuperados = estado.get("recuperados", [])
        relevantes = estado.get("relevantes", [])
        log.info(
            "pregunta=%r consulta=%r recuperados=%d sobre_umbral=%d mejor=%.3f "
            "model_sufficient=%s strong_retrieval=%s decision=%s",
            estado["pregunta"][:80],
            estado.get("consulta"),
            len(recuperados),
            len(relevantes),
            recuperados[0].similitud if recuperados else 0.0,
            estado.get("model_sufficient"),
            estado.get("strong_retrieval"),
            estado.get("decision"),
        )
        return {"historial_id": dep.guardar(estado)}

    return {
        "validate_intent": validate_intent,
        "rewrite_query": rewrite_query,
        "retrieve": retrieve,
        "grade_context": grade_context,
        "generate": generate,
        "reject": reject,
        "save_history": save_history,
    }
