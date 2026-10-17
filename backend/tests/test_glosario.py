"""Glosario de alias espanol -> ingles y su uso en rewrite_query."""

from app.services.glosario import traducir_alias
from tests.test_grafo import LLMFalso, correr, resultados


def test_traduce_alias_con_tildes_y_mayusculas():
    assert traducir_alias("¿cuáles son los poderes del Detective Marciano?") == (
        "¿cuáles son los poderes del Martian Manhunter?"
    )
    assert traducir_alias("¿Quién es la MUJER MARAVILLA?") == "¿Quién es la Wonder Woman?"
    assert traducir_alias("El Hombre Murciélago vive en Ciudad Gótica") == (
        "El Batman vive en Gotham City"
    )


def test_alias_de_chicas_y_chicos():
    assert traducir_alias("¿Quién es la Chica Maravilla?") == "¿Quién es la Wonder Girl?"
    assert traducir_alias("poderes de Superchica") == "poderes de Supergirl"
    assert traducir_alias("la Chica Halcón y el Señor Frío") == "la Hawkgirl y el Mister Freeze"


def test_alias_mas_largo_gana():
    assert traducir_alias("Liga de la Justicia de América") == "Justice League of America"
    assert traducir_alias("la Liga de la Justicia") == "la Justice League"


def test_no_toca_palabras_que_solo_contienen_el_alias():
    assert traducir_alias("los guasones") == "los guasones"
    assert traducir_alias("who is Batman?") == "who is Batman?"


def test_rewrite_query_manda_el_alias_traducido_al_llm():
    prompts_vistos = []

    class LLM(LLMFalso):
        def invoke(self, prompt):
            prompts_vistos.append(prompt)
            return super().invoke(prompt)

    llm = LLM(suficiente=True)
    final, _, _ = correr(llm, resultados(0.9, 0.85, 0.8),
                                 pregunta="poderes del Detective Marciano")
    reescritura = next(p for p in prompts_vistos if p.startswith("Rewrite"))
    assert "Martian Manhunter" in reescritura and "Detective Marciano" not in reescritura
    assert final["pregunta"] == "poderes del Detective Marciano"   # la original se conserva


def test_parece_ingles():
    from app.services.idioma import parece_ingles

    assert parece_ingles("who is Batman?") and parece_ingles("Batman?")
    assert not parece_ingles("¿quién es Batman?")
    assert not parece_ingles("cuales son los poderes del Detective Marciano")
    assert not parece_ingles("Cual es la debilidad de Zorvax")
