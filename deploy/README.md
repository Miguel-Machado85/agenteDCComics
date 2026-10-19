# Despliegue en AWS EC2

Todo el backend corre en una sola EC2 con Docker Compose. Caddy es la única
puerta de entrada (80/443) y saca certificados HTTPS solo.

```text
Internet ──443──> Caddy ──> https://api.<DOMAIN>  -> backend:8000 (FastAPI, /docs)
                        └─> https://auth.<DOMAIN> -> keycloak:8080
backend -> db (Postgres + pgvector) · ollama (qwen2.5:3b) · keycloak (JWKS interno)
```

## Qué hay en esta carpeta

| Archivo | Para qué |
| --- | --- |
| `../compose.prod.yml` | Se suma a `compose.yml`: activa el backend (sin perfil), agrega Caddy, configura Keycloak detrás del proxy, healthcheck del backend |
| `Caddyfile` | Reverse proxy `api.` → backend y `auth.` → Keycloak, con HTTPS automático |
| `env.prod.example` | Plantilla del `.env` de la EC2 (incluye `COMPOSE_FILE`, así `docker compose` usa los dos archivos sin `-f`) |
| `exportar-base.ps1` | **En tu PC**: exporta documentos, chunks y embeddings a `kb.dump` |
| `restaurar-base.sh` | **En la EC2**: restaura `kb.dump` y verifica conteos |
| `keycloak-urls.sh` | **En la EC2**: registra en el cliente `dc-frontend` las URLs públicas de Swagger y del frontend (redirect URIs, web origins y URLs de regreso al cerrar sesión) |
| `update-ip.sh` | **En la EC2**: tras un Stop/Start con IP nueva, actualiza `DOMAIN`, reinicia y vuelve a registrar las URLs |

## ¿Hay que crear algo en Caddy o en sslip.io?

No. Ninguno de los dos tiene cuenta ni panel:

- **sslip.io** es un DNS público que responde con la IP que va escrita en el
  nombre: `api.3-87-12-45.sslip.io` → `3.87.12.45`. Basta con poner
  `DOMAIN=3-87-12-45.sslip.io` en el `.env`.
- **Caddy** es solo la imagen `caddy:2` más el `Caddyfile` de esta carpeta.
  Al arrancar pide los certificados a Let's Encrypt; lo único que necesita es
  que los puertos 80 y 443 de la EC2 estén abiertos al mundo en el Security
  Group. Los certificados quedan en el volumen `caddy_data`.

---

## Paso 1 — En tu PC, antes de crear la instancia

**1.1 Probar el backend en contenedor en local** (valida el `env_file` y la imagen). Detén antes el `uvicorn` de `uv` si lo tienes corriendo en el puerto 8000:

```powershell
docker compose up -d db ollama keycloak
docker compose --profile backend up -d --build backend
docker compose logs -f backend          # Ctrl+C cuando diga "Application startup complete"
curl.exe http://localhost:8000/health
```

Abre <http://localhost:8000/docs>, autoriza con `demo` / `demo` y haz una pregunta. Si funciona aquí, en la EC2 solo cambian el dominio y Caddy.

**1.2 Exportar la base** (los embeddings viajan tal cual; no hay que regenerarlos):

```powershell
.\deploy\exportar-base.ps1
```

Anota los conteos de documentos y chunks que imprime. Si PowerShell bloquea el script: `Set-ExecutionPolicy -Scope Process Bypass`.

**1.3 Anotar una huella** para comprobar en la nube que los vectores llegaron intactos:

```powershell
cd backend
uv run python .\scripts\wiki\buscarPrueba.py "who is Aquaman?" -k 3
cd ..
```

**1.4 Subir los cambios** de esta carpeta a GitHub (`main`), porque la EC2 clona el repo.

---

## Paso 2 — Consola de AWS

1. **EC2 → Launch instance**
   - AMI: Ubuntu Server 24.04 LTS, 64-bit (x86)
   - Tipo: `m7i-flex.large` (2 vCPU, 8 GiB)
   - Key pair: crea uno (`.pem`) y guárdalo
   - Almacenamiento: **30 GiB gp3**
2. **Security Group** (inbound):

   | Tipo | Puerto | Origen |
   | --- | --- | --- |
   | SSH | 22 | IP de cada integrante, como `x.x.x.x/32` (una regla por persona) |
   | HTTP | 80 | 0.0.0.0/0 |
   | HTTPS | 443 | 0.0.0.0/0 |

   Cada integrante saca su IP con `curl.exe https://checkip.amazonaws.com`. Si SSH se queda en *timeout*, casi siempre es porque la IP de esa persona cambió (otra red, o el proveedor la renovó): se actualiza su regla. No abran el 22 a `0.0.0.0/0`.

3. **Billing → Budgets**: alarma mensual (p. ej. USD 10).
4. **IP elástica** (recomendado): *EC2 → Elastic IPs → Allocate* y *Associate* a la instancia. Así el `DOMAIN` no cambia con cada Stop/Start y no hay que tocar Netlify ni Keycloak. Cobra por hora mientras exista: al entregar el proyecto, *Disassociate* y *Release*.
5. Copia la **IP pública** (la elástica, si la asignaron). En este proyecto: `54.91.224.121` → `DOMAIN=54-91-224-121.sslip.io`.

---

## Paso 3 — En la EC2

**3.1 Entrar** (PowerShell en tu PC). Guarda la llave fuera de la carpeta del repo (por ejemplo `C:\Users\<usuario>\.ssh\`) y nunca la subas a GitHub:

```powershell
icacls .\clave.pem /inheritance:r /grant:r "$($env:USERNAME):(R)"   # solo la primera vez
ssh -i .\clave.pem ubuntu@<IP>
```

**3.2 Docker y repo:**

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
exit
```

Vuelve a entrar con `ssh` (para que tome el grupo `docker`) y:

```bash
docker run --rm hello-world
git clone https://github.com/Miguel-Machado85/agenteDCComics.git ~/agenteDCComics
cd ~/agenteDCComics
chmod +x deploy/*.sh      # por si el commit desde Windows perdio el permiso de ejecucion
```

**3.3 `.env` de producción:**

```bash
cp deploy/env.prod.example .env
echo "DOMAIN=$(curl -s https://checkip.amazonaws.com | tr . -).sslip.io"   # copia este valor
nano .env
```

Cambia todo lo que dice `CAMBIAR`: `DOMAIN`, `POSTGRES_PASSWORD` (también dentro de `DATABASE_URL`) y `KEYCLOAK_ADMIN_PASSWORD`. Hazlo **antes** del primer arranque: la clave de admin de Keycloak y la de Postgres solo se fijan la primera vez.

```bash
docker compose config --services    # debe listar backend y caddy
```

**3.4 Subir y restaurar la base.** Desde tu PC:

```powershell
scp -i .\clave.pem .\kb.dump ubuntu@<IP>:~/agenteDCComics/
```

En la EC2:

```bash
./deploy/restaurar-base.sh kb.dump && rm kb.dump
```

Los conteos que imprime deben ser iguales a los del paso 1.2. El script termina levantando el backend (la primera vez construye la imagen: ~10 min).

**3.5 Levantar todo:**

```bash
docker compose up -d                   # db, keycloak, ollama, ollama-pull, backend, caddy
docker compose logs -f ollama-pull     # descarga qwen2.5:3b (~1.9 GB) la primera vez
docker compose ps                      # backend y db "healthy"
docker compose logs caddy | grep -i "certificate obtained"
docker builder prune -f && docker image prune -f
df -h / && free -h
```

**3.6 URLs de Swagger en Keycloak:**

```bash
./deploy/keycloak-urls.sh
```

---

## Paso 4 — Probar desde internet

Desde tu PC (`$D` = tu `DOMAIN`):

```powershell
$D = "3-87-12-45.sslip.io"
curl.exe https://api.$D/health                       # {"status":"ok"}
curl.exe https://auth.$D/realms/dc-comics             # JSON del realm con URLs https://
curl.exe -i https://api.$D/documents                  # 401 sin token
```

En el navegador:

1. `https://api.<DOMAIN>/docs` → **Authorize** → `client_id` `dc-frontend`, secret vacío → **Authorize**.
2. Entra con `demo` / `demo` (o *Register*).
3. `POST /chat` con `{"pregunta": "who is Aquaman?"}`. La primera respuesta tarda más (Qwen se carga en RAM).
4. Compara la similitud de la primera fuente con la huella del paso 1.3: debe ser la misma.
5. Pregunta en español, una fuera de dominio (debe rechazar), sube un `.txt` con `POST /documents`, pregunta por él, revisa `GET /history`.

Consola de Keycloak: `https://auth.<DOMAIN>/admin` con el admin del `.env`.

---

## Paso 5 — Conectar el frontend (Netlify)

El navegador llama directo a `api.` y `auth.`, así que la URL de Netlify tiene que estar en el CORS del backend y en el cliente `dc-frontend` de Keycloak. Se hace una vez, después de crear el sitio (ver [`frontend/README.md`](../frontend/README.md#despliegue-en-netlify)).

En la EC2, desde `~/agenteDCComics`:

```bash
git pull
nano .env
```

Con la URL exacta de Netlify, sin `/` final, y conservando `localhost:5173` para poder desarrollar contra la EC2:

```env
FRONTEND_URL=https://agente-dc-comics.netlify.app
CORS_ORIGINS=http://localhost:5173,https://agente-dc-comics.netlify.app
```

```bash
docker compose up -d backend      # recrea el backend con el CORS nuevo (no reconstruye la imagen)
./deploy/keycloak-urls.sh         # redirect URIs, web origins y post-logout de dc-frontend
```

Comprobar desde tu PC:

```powershell
$D = "54-91-224-121.sslip.io"
curl.exe -i -X OPTIONS "https://api.$D/chat" -H "Origin: https://agente-dc-comics.netlify.app" -H "Access-Control-Request-Method: POST"
# debe traer: access-control-allow-origin: https://agente-dc-comics.netlify.app
```

Y en el navegador, en incógnito y desde la URL de Netlify: login, registro, una pregunta, subir y borrar un documento, historial y cerrar sesión.

---

## Día a día

| Acción | Comando |
| --- | --- |
| Estado | `docker compose ps` |
| Logs del agente | `docker compose logs -f backend` |
| Desplegar código nuevo | `git pull && docker compose up -d --build backend` |
| Apagar | Consola AWS → *Stop instance* (los contenedores vuelven solos al encender) |
| IP nueva tras Start (solo sin IP elástica) | `./deploy/update-ip.sh`, y en Netlify actualizar `VITE_API_URL` y `VITE_KEYCLOAK_URL` y volver a desplegar |
| Cambió la URL del frontend | `FRONTEND_URL` y `CORS_ORIGINS` en `.env`, `docker compose up -d backend` y `./deploy/keycloak-urls.sh` |
| Antes de una demo | Encender 30 min antes y hacer una pregunta de calentamiento (Qwen queda en RAM) |
| Modelo descargado | `docker compose exec ollama ollama list` |
| Documentos y chunks | `docker compose exec db psql -U dcagent -d dcagent -c "SELECT source, count(*) FROM documents GROUP BY source;"` |

Nunca uses `docker compose down -v`: borra la base, el modelo y los certificados.