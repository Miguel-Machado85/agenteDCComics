# Frontend — Agente DC Comics

SPA en React 18 + Vite + TypeScript + Tailwind CSS v4 para conversar con el agente RAG de DC Comics. El agente se presenta como **SuperBot**, un personaje propio del proyecto (SVG original, sin logos ni personajes oficiales de DC). El inicio de sesión y el registro van por Keycloak; los datos, por la API FastAPI de `/backend`.

En producción está en Netlify: `https://agente-dc-comics.netlify.app` (ver [Despliegue en Netlify](#despliegue-en-netlify)).

## Qué hace

| Ruta | Pantalla |
|---|---|
| `/` | Portada de SuperBot con preguntas de ejemplo |
| `/chat` | Chat con el agente: fuentes con su similitud, rechazo explícito cuando no hay información y errores del servidor con *Reintentar* |
| `/documentos` | Subir PDF, TXT, MD, CSV o DOCX (máx. 10 MB), listar los subidos y la wiki, borrar los propios |
| `/historial` | Preguntas anteriores del usuario, paginadas |

Todas las rutas exigen sesión: sin token, Keycloak muestra su página de login (con enlace de registro) antes de que se monte la app.

## Requisitos

- Node.js 20.19+ o 22.12+ (con npm)
- Un backend con Keycloak al que apuntar, uno de los dos:
  - **Local** (sección *Backend local* del [README de la raíz](../README.md)): API en `http://localhost:8000` y Keycloak en `http://localhost:8080`, realm `dc-comics` (usuario de prueba `demo` / `demo`).
  - **La EC2** (ver [Probar contra la EC2](#probar-contra-la-ec2)): no hace falta Docker en el PC.

## Variables de entorno

No hay `.env` en esta carpeta: Vite lee el `.env` de la **raíz** del repo (`envDir: '..'`). Copia `.env.example` a `.env` en la raíz si no lo tienes; la sección *Frontend (Vite)* trae las cuatro variables:

| Variable | Valor local | Para qué |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | URL base de la API |
| `VITE_KEYCLOAK_URL` | `http://localhost:8080` | Servidor de Keycloak |
| `VITE_KEYCLOAK_REALM` | `dc-comics` | Realm |
| `VITE_KEYCLOAK_CLIENT_ID` | `dc-frontend` | Cliente público (PKCE) |
| `VITE_CHAT_TIMEOUT_S` | *(opcional, 600)* | Segundos que el chat espera `POST /chat` |

Usa `localhost` y no `127.0.0.1`: el issuer del token tiene que coincidir con `KEYCLOAK_ISSUER` del backend. Las `VITE_*` terminan en el navegador, así que nunca pongas secretos con ese prefijo. Si falta alguna, la app no arranca y lo dice en la consola.

Vite incrusta las variables al arrancar `npm run dev` o al compilar: si cambias una, reinicia el servidor de desarrollo (o vuelve a desplegar en Netlify).

El timeout del chat es alto a propósito: en la EC2 (2 vCPU, sin GPU) una pregunta puede pasar de 3 minutos y Ollama atiende una a la vez. Si el navegador se rinde antes, el backend termina igual y la respuesta aparece en **Historial**.

## Probar contra la EC2

Para que tu `npm run dev` use el backend desplegado, cambia solo estas dos líneas del `.env` de la raíz y reinicia `npm run dev`:

```env
VITE_API_URL=https://api.54-91-224-121.sslip.io
VITE_KEYCLOAK_URL=https://auth.54-91-224-121.sslip.io
```

La EC2 ya acepta `http://localhost:5173` en el CORS y en las redirect URIs de Keycloak. Para volver al backend local, devuélvelas a `http://localhost:8000` y `http://localhost:8080`.

No uses `deploy/env.prod.example` como `.env` de tu PC: es la plantilla del `.env` de la EC2 (no trae las `VITE_*` y activa Caddy en tu Docker).

## Cómo correrlo (PowerShell)

```powershell
cd frontend
npm install
npm run dev
```

Abre <http://localhost:5173>. El puerto es fijo: Keycloak y el CORS del backend solo aceptan ese origen.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Revisa tipos (`tsc -b`) y genera `dist/` |
| `npm run preview` | Sirve `dist/` para probar el build |
| `npm run lint` | oxlint |
| `npm test` | Pruebas con Vitest (jsdom + Testing Library) |

## Estructura

```
frontend/
  index.html              entrada de Vite (favicon, fuentes y título base)
  netlify.toml            build, Node 22, fallback SPA y cabeceras de seguridad para Netlify
  public/                 favicon.svg y _redirects (fallback SPA)
  src/
    main.tsx              inicia Keycloak y monta la app
    App.tsx               rutas: / (portada), /chat, /documentos, /historial y 404
    config.ts             lee y valida las VITE_*
    index.css             Tailwind y tokens del tema
    api/                  wrapper de fetch (client.ts), tipos y llamadas por recurso
    auth/                 instancia de keycloak-js y AuthContext (usuario y logout)
    components/
      layout/             Layout, Header (usuario y Cerrar sesión) y NavBar
      chat/               ventana, burbujas, input y panel de fuentes
      documents/          zona de subida, tabla, pestañas y confirmación de borrado
      history/            tarjeta de una pregunta del historial
      superbot/           SVG de SuperBot (cara y retrato)
      ui/                 EmptyState, ErrorBanner, Pagination y Skeleton
    hooks/                useChat, useDocuments, useHistory, useTituloPagina, useFocusTrap
    pages/                IntroPage, ChatPage, DocumentsPage, HistoryPage y NotFoundPage
    utils/                formato de fechas y números, validación de archivos
```

Las pruebas (`*.test.ts`, `*.test.tsx`) viven junto al código que prueban.

## Despliegue en Netlify

El sitio está conectado al repo y se reconstruye solo con cada push a `main` que toque `frontend/` (el `ignore` de `netlify.toml` salta los commits que solo cambian el backend).

| Campo en Netlify | Valor |
|---|---|
| Branch to deploy | `main` |
| Base directory | `frontend` |
| Build command | `npm run build` (de `netlify.toml`) |
| Publish directory | `frontend/dist` |
| Node | 22 (`NODE_VERSION` en `netlify.toml`; Vite 8 pide 20.19+) |

Variables en **Site configuration → Environment variables** (no se usa ningún `.env` en Netlify):

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://api.54-91-224-121.sslip.io` |
| `VITE_KEYCLOAK_URL` | `https://auth.54-91-224-121.sslip.io` |
| `VITE_KEYCLOAK_REALM` | `dc-comics` |
| `VITE_KEYCLOAK_CLIENT_ID` | `dc-frontend` |

Van con `https` y sin `/` final. Después de crear o cambiar una variable: **Deploys → Trigger deploy → Deploy site**.

Del lado de la EC2, la URL de Netlify tiene que estar registrada en el CORS del backend y en Keycloak: ver [Paso 5 de `deploy/README.md`](../deploy/README.md#paso-5--conectar-el-frontend-netlify).

### Problemas comunes

| Síntoma | Causa | Arreglo |
|---|---|---|
| `Invalid parameter: redirect_uri` en Keycloak | La URL de Netlify no está en el cliente `dc-frontend` | En la EC2: `FRONTEND_URL` en `.env` y `./deploy/keycloak-urls.sh` |
| `Invalid redirect uri` al cerrar sesión | Falta `post.logout.redirect.uris` en el cliente | `git pull` en la EC2 y `./deploy/keycloak-urls.sh` (ya lo configura) |
| Error de CORS en la consola | `CORS_ORIGINS` de la EC2 no trae la URL exacta | Corregir el `.env` de la EC2 y `docker compose up -d backend` |
| `Mixed Content` en la consola | Alguna `VITE_*` está con `http://` | Corregirla en Netlify y volver a desplegar |
| 404 de Netlify al recargar una ruta | Falta el fallback SPA | `netlify.toml` y `public/_redirects` ya lo traen; revisar que la base sea `frontend` |
| 401 en todo aunque el login funcionó | El issuer del token no coincide con el del backend | `VITE_KEYCLOAK_URL` debe ser exactamente `https://auth.<DOMAIN>` |
| No carga el login ni el chat | La EC2 está detenida | Encenderla y hacer una pregunta de calentamiento |
| El login falla en un *deploy preview* | Esa URL (`deploy-preview-N--…`) no está registrada en Keycloak | Normal: probar en la URL de producción |

## Capturas

Las imágenes van en `docs/capturas/` (en la raíz del repo).

### Chat

![Chat con el agente](../docs/capturas/chat.png)

### Respuesta rechazada

![Respuesta fuera de las fuentes](../docs/capturas/rechazada.png)

### Documentos

![Subida y lista de documentos](../docs/capturas/documentos.png)

### Historial

![Historial de preguntas](../docs/capturas/historial.png)

### Móvil (375 px)

![Vista móvil](../docs/capturas/movil.png)