"""
Enrutamiento del grafo con un LLM falso y un buscador falso (sin Ollama ni Postgres).

El LLM falso reconoce cada prompt por su encabezado y responde lo que se le
configuro; cuenta cuantas veces se llamo a cada paso para comprobar, por
ejemplo, que un saludo no busca o que sin chunks no se llama al grader.
"""

from app.agent import prompts
from app.agent.grafo import construir_grafo
from app.agent.nodos import Dependencias
from app.services.retrieval import Resultado


class LLMFalso:
    def __init__(self, intencion="pregunta", suficiente=False, generacion="Superman is Kal-El [1]."):
        self.intencion = intencion
        self.suficiente = suficiente
        self.generacion = generacion
        self.llamadas = {"intencion": 0, "reescritura": 0, "evaluacion": 0, "generacion": 0}

    def invoke(self, prompt):
        if prompt.startswith("Classify"):
            self.llamadas["intencion"] += 1
            return f'{{"intencion": "{self.intencion}"}}'
        if prompt.startswith("Rewrite"):
            self.llamadas["reescritura"] += 1
            return "Superman powers"
        if prompt.startswith("Decide"):
            self.llamadas["evaluacion"] += 1
            return '{"suficiente": ' + str(self.suficiente).lower() + "}"
        self.llamadas["generacion"] += 1
        return self.generacion


def resultados(*similitudes):
    return [
        Resultado(s, f"Pagina {i}", f"http://x/{i}", "Powers", f"Pagina {i} - Powers\ntexto {i}", i)
        for i, s in enumerate(similitudes, 1)
    ]


def correr(llm, encontrados, pregunta="who is Superman?"):
    busquedas, guardados = [], []

    def buscar(consulta, k):
        busquedas.append(consulta)
        return encontrados

    def guardar(estado):
        guardados.append(estado)
        return 99

    grafo = construir_grafo(Dependencias(llm=llm, buscar=buscar, guardar=guardar))
    final = grafo.invoke({"pregunta": pregunta, "usuario_sub": "u1", "username": "demo", "historial": []})
    return final, busquedas, guardados


def test_sin_chunks_sobre_umbral_rechaza_sin_llamar_al_grader():
    llm = LLMFalso(suficiente=True)
    final, _, guardados = correr(llm, resultados(0.69, 0.60))
    assert final["rechazada"] is True
    assert final["respuesta"].startswith(prompts.MENSAJE_RECHAZO)
    assert final["fuentes"] == []
    assert llm.llamadas["evaluacion"] == 0 and llm.llamadas["generacion"] == 0
    assert final["historial_id"] == 99 and len(guardados) == 1


def test_strong_retrieval_genera_aunque_el_grader_diga_que_no():
    llm = LLMFalso(suficiente=False)
    final, _, _ = correr(llm, resultados(0.90, 0.85, 0.80))
    assert final["model_sufficient"] is False
    assert final["strong_retrieval"] is True
    assert final["rechazada"] is False
    assert final["respuesta"] == llm.generacion
    assert len(final["fuentes"]) == 3
    assert final["fuentes"][0]["similitud"] == 0.9


def test_recuperacion_debil_y_grader_negativo_rechaza():
    llm = LLMFalso(suficiente=False)
    final, _, _ = correr(llm, resultados(0.76, 0.74, 0.72))
    assert final["strong_retrieval"] is False
    assert final["rechazada"] is True
    assert llm.llamadas["generacion"] == 0


def test_recuperacion_debil_y_grader_positivo_genera():
    llm = LLMFalso(suficiente=True)
    final, _, _ = correr(llm, resultados(0.76, 0.74))
    assert final["strong_retrieval"] is False
    assert final["rechazada"] is False
    assert llm.llamadas["generacion"] == 1


def test_marcador_sin_informacion_se_trata_como_rechazo():
    llm = LLMFalso(suficiente=True, generacion=prompts.MARCADOR_SIN_INFO)
    final, _, guardados = correr(llm, resultados(0.90, 0.85, 0.80))
    assert final["rechazada"] is True
    assert final["respuesta"].startswith(prompts.MENSAJE_RECHAZO)
    assert final["fuentes"] == []
    assert guardados[0]["rechazada"] is True


def test_saludo_no_busca_y_no_cuenta_como_rechazo():
    llm = LLMFalso(intencion="saludo")
    final, busquedas, guardados = correr(llm, resultados(0.9), pregunta="hola")
    assert busquedas == []
    assert final["rechazada"] is False
    assert final["intencion"] == "saludo"
    assert final["respuesta"] == prompts.MENSAJE_SALUDO
    assert len(guardados) == 1


def test_pregunta_ambigua_pide_aclaracion_sin_buscar():
    llm = LLMFalso(intencion="ambigua")
    final, busquedas, _ = correr(llm, resultados(0.9), pregunta="y eso?")
    assert busquedas == []
    assert final["rechazada"] is False
    assert final["respuesta"] == prompts.MENSAJE_ACLARACION


def test_intencion_invalida_se_trata_como_pregunta():
    llm = LLMFalso(intencion="otra-cosa", suficiente=True)
    final, busquedas, _ = correr(llm, resultados(0.9, 0.85, 0.8))
    assert final["intencion"] == "pregunta"
    assert len(busquedas) == 1
