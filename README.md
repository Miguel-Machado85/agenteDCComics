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

### Backend en contenedor (opcional)

```powershell
docker compose --profile backend up -d --build backend
```
