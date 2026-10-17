"""
Glosario de alias espanol -> ingles para el universo DC.

La base esta en ingles y el nombre oficial de un personaje, equipo o lugar
suele ser distinto en las traducciones al espanol ("Detective Marciano" es
Martian Manhunter). Un modelo de 3B no traduce esos alias de forma confiable,
asi que se reemplazan en codigo, antes de que el LLM reescriba la consulta.

La busqueda ignora mayusculas y tildes, y respeta limites de palabra. Se
prueban primero los alias mas largos para que "Liga de la Justicia de America"
no quede a medias por "Liga de la Justicia".
"""

import re
import unicodedata

ALIAS_ES_EN = {
    # Heroes
    "detective marciano": "Martian Manhunter",
    "cazador marciano": "Martian Manhunter",
    "mujer maravilla": "Wonder Woman",
    "hombre murcielago": "Batman",
    "caballero oscuro": "Batman",
    "chico maravilla": "Robin",
    "linterna verde": "Green Lantern",
    "flecha verde": "Green Arrow",
    "hombre de acero": "Superman",
    "mujer gato": "Catwoman",
    "chica murcielago": "Batgirl",
    "canario negro": "Black Canary",
    "hombre halcon": "Hawkman",
    "escarabajo azul": "Blue Beetle",
    # Villanos
    "el guason": "Joker",
    "guason": "Joker",
    "el acertijo": "Riddler",
    "acertijo": "Riddler",
    "el pinguino": "Penguin",
    "pinguino": "Penguin",
    "espantapajaros": "Scarecrow",
    "hiedra venenosa": "Poison Ivy",
    "arlequina": "Harley Quinn",
    "dos caras": "Two-Face",
    # Equipos y organizaciones
    "liga de la justicia de america": "Justice League of America",
    "liga de la justicia": "Justice League",
    "jovenes titanes": "Teen Titans",
    "sociedad de la justicia": "Justice Society of America",
    "escuadron suicida": "Suicide Squad",
    "legion de superheroes": "Legion of Super-Heroes",
    "cuerpo de linternas verdes": "Green Lantern Corps",
    "cuerpo de los linternas verdes": "Green Lantern Corps",
    "legion de la perdicion": "Legion of Doom",
    # Lugares
    "ciudad gotica": "Gotham City",
    "isla paraiso": "Themyscira",
    "themiscira": "Themyscira",
    "fortaleza de la soledad": "Fortress of Solitude",
    "cueva de los murcielagos": "Batcave",
    "mansion wayne": "Wayne Manor",
    "asilo arkham": "Arkham Asylum",
    "atlantida": "Atlantis",
    "tierra uno": "Earth-One",
    "tierra dos": "Earth-Two",
}


def _sin_tildes(texto: str) -> str:
    # Un caracter por caracter, para que las posiciones coincidan con el original
    return "".join(unicodedata.normalize("NFD", c)[0] for c in texto.lower())


_PATRON = re.compile(
    r"(?<!\w)(" + "|".join(re.escape(a) for a in sorted(ALIAS_ES_EN, key=len, reverse=True)) + r")(?!\w)"
)


def traducir_alias(texto: str) -> str:
    """Reemplaza los alias en espanol por su nombre oficial en ingles."""
    plano = _sin_tildes(texto)
    partes, pos = [], 0
    for m in _PATRON.finditer(plano):
        partes.append(texto[pos:m.start()])
        partes.append(ALIAS_ES_EN[m.group(1)])
        pos = m.end()
    partes.append(texto[pos:])
    return "".join(partes)
