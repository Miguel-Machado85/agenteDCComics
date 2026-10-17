"""
Estado que viaja por el grafo del agente.

Es un TypedDict porque LangGraph mezcla en el estado lo que cada nodo
devuelve: un nodo solo regresa las claves que cambia. `total=False` permite
armar el estado inicial solo con la pregunta, el usuario y el historial.
"""

from typing import TypedDict

from app.services.retrieval import Resultado


class EstadoAgente(TypedDict, total=False):
    # Entrada
    pregunta: str
    usuario_sub: str
    username: str
    historial: list[dict]            # ultimos turnos: {"pregunta", "respuesta"}

    # Pasos intermedios
    intencion: str                   # pregunta | saludo | ambigua
    consulta: str                    # consulta autonoma en ingles para buscar
    recuperados: list[Resultado]     # top-k sin filtrar
    relevantes: list[Resultado]      # los que pasan el umbral
    model_sufficient: bool | None    # None si no se llamo al grader
    strong_retrieval: bool
    suficiente: bool

    # Salida
    respuesta: str
    respuesta_cruda: str             # salida del LLM en generate, antes de procesarla
    rechazada: bool
    reintento: bool                  # generate reintento con el prompt directo
    decision: str                    # saludo | ambigua | generate | reject
    fuentes: list[dict]
    historial_id: int
