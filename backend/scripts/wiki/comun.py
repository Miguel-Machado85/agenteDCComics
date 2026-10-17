"""
Utilidades compartidas por los scripts de ingesta de DC Database.

Rutas: todos los scripts leen y escriben en la carpeta data/ de la raiz del
repositorio (o en la que indique la variable de entorno DATA_DIR).
"""

import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://dc.fandom.com/api.php"
WIKI_URL = "https://dc.fandom.com/wiki/"
USER_AGENT = "DCAgentUniversidad/0.1 (proyecto academico)"
PAUSA_SEG = 1.0  # una peticion por segundo, para no sobrecargar el wiki

# backend/scripts/wiki/comun.py -> parents[3] es la raiz del repositorio
RAIZ_REPO = Path(__file__).resolve().parents[3]
DATA_DIR = Path(os.environ.get("DATA_DIR", RAIZ_REPO / "data"))
RAW_DIR = DATA_DIR / "raw"
CACHE_DIR = DATA_DIR / "cache_categorias"
SEED_TITLES = DATA_DIR / "seed_titles.txt"


def llamar_api(params, intentos=6):
    """POST a la API de MediaWiki. Reintenta ante errores de red y 'maxlag'."""
    params = {**params, "format": "json", "formatversion": "2", "maxlag": "5"}
    datos = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(API, data=datos, headers={"User-Agent": USER_AGENT})
    for intento in range(intentos):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.load(resp)
        except Exception as e:  # red inestable: esperar cada vez mas y reintentar
            espera = 5 * (intento + 1)
            print(f"    error de red ({e}); reintentando en {espera}s")
            time.sleep(espera)
            continue
        if "error" in data:
            if data["error"].get("code") == "maxlag":  # servidor ocupado
                time.sleep(5)
                continue
            raise RuntimeError(f"Error de la API: {data['error']}")
        return data
    raise RuntimeError(f"La API no respondio despues de {intentos} intentos")


def url_de(titulo):
    """URL publica de una pagina del wiki."""
    return WIKI_URL + urllib.parse.quote(titulo.replace(" ", "_"), safe="()',:/!")