"""
Construccion del grafo LangGraph del agente.

    validate_intent -> rewrite_query -> retrieve -> grade_context -> generate | reject -> save_history
          |                                                              |
          +-- saludo / ambigua ------------------------------------------+--> save_history

Los saludos y las preguntas ambiguas saltan directo a save_history: no
buscan y no cuentan como rechazo. Si generate devuelve el marcador de "sin
informacion", la decision cambia a reject. El grafo se escribe en codigo (sin
herramientas visuales) y recibe sus dependencias para poder probarse con dobles.
"""

from langgraph.graph import END, START, StateGraph

from app.agent.estado import EstadoAgente
from app.agent.nodos import Dependencias, crear_nodos


def _tras_intencion(estado: EstadoAgente) -> str:
    return "save_history" if estado["intencion"] != "pregunta" else "rewrite_query"


def _tras_evaluacion(estado: EstadoAgente) -> str:
    return "generate" if estado["suficiente"] else "reject"


def _tras_generacion(estado: EstadoAgente) -> str:
    return "reject" if estado["decision"] == "reject" else "save_history"


def construir_grafo(dep: Dependencias):
    nodos = crear_nodos(dep)
    g = StateGraph(EstadoAgente)
    for nombre, funcion in nodos.items():
        g.add_node(nombre, funcion)

    g.add_edge(START, "validate_intent")
    g.add_conditional_edges("validate_intent", _tras_intencion,
                            ["rewrite_query", "save_history"])
    g.add_edge("rewrite_query", "retrieve")
    g.add_edge("retrieve", "grade_context")
    g.add_conditional_edges("grade_context", _tras_evaluacion, ["generate", "reject"])
    g.add_conditional_edges("generate", _tras_generacion, ["reject", "save_history"])
    g.add_edge("reject", "save_history")
    g.add_edge("save_history", END)
    return g.compile()
