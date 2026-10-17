"""
Deteccion basica de idioma (espanol vs ingles) para decidir si hay que traducir.

No hace falta una libreria: el agente solo distingue "claramente ingles" de lo
demas. Se cuentan palabras funcionales de cada idioma y marcas propias del
espanol (¿ ¡ ñ vocales con tilde). Una pregunta de una sola palabra
("Batman?") cuenta como ingles: no hay nada que traducir.
"""

import re

PALABRAS_ES = {
    "que", "quien", "quienes", "cual", "cuales", "es", "son", "el", "la", "los", "las", "de", "del",
    "como", "por", "para", "un", "una", "en", "y", "donde", "cuando", "cuanto", "con", "sus", "su",
    "se", "al", "hay", "fue", "tiene", "puede", "poderes", "debilidad", "mejor", "cuantos",
}
PALABRAS_EN = {
    "what", "who", "which", "is", "are", "the", "of", "how", "why", "where", "when", "does", "do",
    "did", "was", "were", "his", "her", "its", "their", "in", "and", "to", "for", "with", "a", "an",
    "has", "have", "can", "about", "from",
}
_MARCAS_ES = re.compile(r"[¿¡ñáéíóúü]", re.IGNORECASE)


def parece_ingles(texto: str) -> bool:
    if _MARCAS_ES.search(texto):
        return False
    palabras = re.findall(r"[a-z]+", texto.lower())
    es = sum(p in PALABRAS_ES for p in palabras)
    en = sum(p in PALABRAS_EN for p in palabras)
    return es <= en
