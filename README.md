# agenteDCComics

Agente RAG sobre el universo DC Comics (FastAPI + LangGraph + Ollama + pgvector + Keycloak).

## Backend local

### Requisitos

- Docker Desktop (db, Ollama y Keycloak corren en contenedores)
- [uv](https://docs.astral.sh/uv/) con Python 3.12
- Unos 6 GB libres: imagen de Ollama, modelo `qwen2.5:3b` (~2 GB) y modelo de embeddings (se baja la primera vez)

### Configuración (`.env`)

Copia `.env.example` a `.env` en la raíz y ajusta las claves. Para correr en tu máquina los valores por defecto sirven. Dos cosas importantes:

- Usa `127.0.0.1` y no `localhost` en `DATABASE_URL`, `OLLAMA_BASE_URL` y `KEYCLOAK_JWKS_URL`. En Windows con Docker Desktop, `localhost` puede tardar minutos en conectar y cada pregunta se cuelga.
- `KEYCLOAK_ISSUER` sí lleva `localhost`: es lo que ve el navegador y va dentro del token.

### Arranque (PowerShell, desde la raíz del repo)

```powershell
# 1. Variables de entorno
Copy-Item .env.example .env

# 2. Infraestructura: Postgres + pgvector, Ollama y Keycloak (crea su base y importa el realm)
docker compose up -d db ollama keycloak

# 3. Descargar el modelo del LLM (solo la primera vez)
docker compose run --rm ollama-pull

# 4. Dependencias del backend
cd backend
uv sync

# 5. Base de conocimiento (solo si la base está vacía; ver backend/scripts/wiki)
#    uv run .\scripts\wiki\cargarPgvector.py

# 6. API en http://localhost:8000
uv run uvicorn app.main:app --reload
```

Nunca uses `docker compose down -v`: borra el volumen con la base cargada. Para apagar usa `docker compose down`.

### Probar desde Swagger

1. Abre <http://localhost:8000/docs> y pulsa **Authorize**.
2. `client_id` ya viene como `dc-frontend`; deja `client_secret` vacío y pulsa **Authorize**.
3. Entra con el usuario `demo` / `demo` (o crea uno con *Register*).
4. Vuelve a Swagger, cierra el diálogo y usa `POST /chat` con `{"pregunta": "who is Aquaman?"}`.

El token dura 5 minutos; si un endpoint responde 401, repite el paso 2. Con CPU, una pregunta tarda entre 30 y 50 segundos.

### Tests

No necesitan Ollama, Keycloak ni Postgres:

```powershell
cd backend
uv run pytest
uv run ruff check app tests
```

### Limitaciones conocidas

- La base está en inglés y el LLM es un 3B. Los alias comunes en español se traducen en código (`app/services/glosario.py`: "Detective Marciano" → Martian Manhunter). Los que no estén en el glosario dependen de que el 3B los reescriba bien; conviene ampliar el glosario cuando falle un nombre.
- Para preguntas en español el agente busca con la consulta en inglés y con la pregunta original (`SEARCH_ORIGINAL_QUESTION`), genera en inglés y traduce la respuesta con una segunda llamada al LLM (`TRANSLATE_ANSWERS`). La traducción del 3B puede tener fallos menores ("Jocker", palabras sueltas en inglés) y a veces entrega el encabezado del fragmento en vez de redactar. Se asume que todo idioma que no sea inglés es español.
- El evaluador (`grade_context`) casi siempre responde "no suficiente"; la decisión la toma sobre todo el criterio de recuperación fuerte (`STRONG_*`). Por eso, con recuperación fuerte el grader del LLM no se llama (`SKIP_GRADER_IF_STRONG=true`): el resultado sería el mismo y en la EC2 ahorra ~30 s por pregunta. Si el modelo devuelve el marcador `NOT_IN_CONTEXT` con recuperación fuerte, `generate` reintenta una vez.
- Con 10 chunks en el prompt (`MAX_CHUNKS_PROMPT`) el modelo ve más contexto, pero la respuesta puede quedar fuera de los 10 primeros (p. ej. el origen del anillo de Hal Jordan está hacia el puesto 10–14).
- Preguntas fuera de dominio sobre temas del mundo real que la base sí contiene (la página "France", "Paris, France", etc.) pueden responderse, porque la recuperación es fuerte (similitud ~0.87). Las demás (recetas, deportes, programación, otras franquicias) se rechazan por similitud o porque el modelo devuelve el marcador.
- Con CPU, una pregunta tarda entre 15 y 50 segundos según el estado de la caché de Ollama.

### Medir el agente

`scripts/wiki/evaluarNombres.py` corre el banco `tests/datos/preguntas_nombres.csv`. Sin opciones mide solo reescritura + búsqueda (aciertos en el top-10). Con `--completo` corre el grafo entero sin guardar historial y reporta en qué etapa terminó cada pregunta, la respuesta cruda del LLM y el tiempo (el detalle queda en `data/evaluacion_completo_<etiqueta>.json`):

```powershell
cd backend
uv run python .\scripts\wiki\evaluarNombres.py
uv run python .\scripts\wiki\evaluarNombres.py --completo --etiqueta prueba
```

### Backend en contenedor (opcional)

```powershell
docker compose --profile backend up -d --build backend
```

El contenedor recibe todas las variables del `.env` (`env_file`); las URLs de la base, Ollama y el JWKS las reemplaza compose por los nombres de servicio.

## Despliegue en AWS EC2

Ver [`deploy/README.md`](deploy/README.md): Caddy con HTTPS automático sobre `sslip.io`, base de conocimiento restaurada desde un dump (sin regenerar embeddings) y scripts para el cambio de IP.
