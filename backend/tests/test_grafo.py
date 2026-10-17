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
        self.llamadas = {"intencion": 0, "reescritura": 0, "evaluacion": 0, "generacion": 0, "traduccion": 0}

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
        if prompt.startswith("Translate"):
            self.llamadas["traduccion"] += 1
            return "[traducida] " + prompt.split("Text: ", 1)[1].split("\n\nSpanish translation:")[0]
        self.llamadas["generacion"] += 1
        self.prompt_generacion = prompt
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
    assert len(busquedas) == 2   # consulta reescrita + pregunta original


def test_generate_recibe_la_consulta_en_ingles():
    llm = LLMFalso(suficiente=True)
    correr(llm, resultados(0.90, 0.85, 0.80), pregunta="poderes del Detective Marciano?")
    assert "Question: Superman powers" in llm.prompt_generacion   # consulta reescrita
    assert "Detective Marciano" not in llm.prompt_generacion


def test_pregunta_en_espanol_traduce_la_respuesta():
    llm = LLMFalso(suficiente=True)
    final, _, _ = correr(llm, resultados(0.90, 0.85, 0.80), pregunta="¿quién es Superman?")
    assert llm.llamadas["traduccion"] == 1
    assert final["respuesta"] == "[traducida] " + llm.generacion


def test_pregunta_en_ingles_no_traduce():
    llm = LLMFalso(suficiente=True)
    final, _, _ = correr(llm, resultados(0.90, 0.85, 0.80), pregunta="who is Superman?")
    assert llm.llamadas["traduccion"] == 0
    assert final["respuesta"] == llm.generacion


def test_rechazo_por_marcador_no_gasta_traduccion():
    llm = LLMFalso(suficiente=True, generacion=prompts.MARCADOR_SIN_INFO)
    final, _, _ = correr(llm, resultados(0.90, 0.85, 0.80), pregunta="¿quién es Superman?")
    assert final["rechazada"] is True and llm.llamadas["traduccion"] == 0


def test_busqueda_une_consulta_y_pregunta_original_con_la_mejor_similitud():
    llamadas = []
    por_consulta = {
        "Superman powers": resultados(0.80, 0.75),             # ids 1 y 2
        "poderes de Superman": resultados(0.88)[:1] + [        # el id 1 mejora; el 3 es nuevo
            Resultado(0.78, "Otra", None, None, "Otra - X\ntexto", 3)],
    }

    def buscar(consulta, k):
        llamadas.append(consulta)
        return por_consulta[consulta]

    llm = LLMFalso(suficiente=True)
    grafo = construir_grafo(Dependencias(llm=llm, buscar=buscar, guardar=lambda e: 1))
    final = grafo.invoke({"pregunta": "poderes de Superman", "usuario_sub": "u", "historial": []})
    assert llamadas == ["Superman powers", "poderes de Superman"]
    sims = [round(r.similitud, 2) for r in final["recuperados"]]
    assert sims == [0.88, 0.78, 0.75]
