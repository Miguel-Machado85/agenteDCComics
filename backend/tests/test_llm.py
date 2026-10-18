"""Limites del cliente de Ollama: sin ellos, un bucle de repeticion del 3B
deja la CPU al 100 % y bloquea las demas preguntas."""

from app.agent.llm import crear_llm
from app.core.config import settings


def test_llm_tiene_tope_de_salida_y_timeout():
    crear_llm.cache_clear()
    llm = crear_llm()
    assert llm.num_predict == settings.llm_num_predict
    assert llm.client_kwargs["timeout"] == settings.llm_timeout_s
    assert llm.format is None


def test_llm_json_tiene_tope_corto():
    crear_llm.cache_clear()
    llm = crear_llm(modo_json=True)
    assert llm.num_predict == settings.llm_num_predict_json
    assert llm.num_predict < settings.llm_num_predict
    assert llm.format == "json"


def test_num_thread_vacio_en_env_es_none(monkeypatch):
    from app.core.config import Settings

    monkeypatch.setenv("LLM_NUM_THREAD", "")
    assert Settings().llm_num_thread is None
    monkeypatch.setenv("LLM_NUM_THREAD", "2")
    assert Settings().llm_num_thread == 2
