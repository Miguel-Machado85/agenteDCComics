# Frontend — Agente DC Comics

SPA en React 18 + Vite + TypeScript + Tailwind CSS v4 para conversar con el agente RAG de DC Comics. El inicio de sesión y el registro van por Keycloak; los datos, por la API FastAPI de `/backend`.

## Requisitos

- Node.js 20.19+ o 22.12+ (con npm)
- Backend y Keycloak corriendo (ver la sección *Backend local* del [README de la raíz](../README.md)):
  - API en `http://localhost:8000`
  - Keycloak en `http://localhost:8080`, realm `dc-comics` (usuario de prueba `demo` / `demo`)

## Variables de entorno

No hay `.env` en esta carpeta: Vite lee el `.env` de la **raíz** del repo (`envDir: '..'`). Copia `.env.example` a `.env` en la raíz si no lo tienes; la sección *Frontend (Vite)* trae las cuatro variables:

| Variable | Valor local | Para qué |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | URL base de la API |
| `VITE_KEYCLOAK_URL` | `http://localhost:8080` | Servidor de Keycloak |
| `VITE_KEYCLOAK_REALM` | `dc-comics` | Realm |
| `VITE_KEYCLOAK_CLIENT_ID` | `dc-frontend` | Cliente público (PKCE) |

Usa `localhost` y no `127.0.0.1`: el issuer del token tiene que coincidir con `KEYCLOAK_ISSUER` del backend. Las `VITE_*` terminan en el navegador, así que nunca pongas secretos con ese prefijo. Si falta alguna, la app no arranca y lo dice en la consola.

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
  index.html              entrada de Vite (favicon y título base)
  public/                 favicon.svg y _redirects (fallback SPA)
  src/
    main.tsx              inicia Keycloak y monta la app
    App.tsx               rutas: /chat, /documentos, /historial y 404
    config.ts             lee y valida las VITE_*
    index.css             Tailwind y tokens del tema
    api/                  wrapper de fetch (client.ts), tipos y llamadas por recurso
    auth/                 instancia de keycloak-js y AuthContext (usuario y logout)
    components/
      layout/             Layout, Header (usuario y Cerrar sesión) y NavBar
      chat/               ventana, burbujas, input y panel de fuentes
      documents/          zona de subida, tabla, pestañas y confirmación de borrado
      history/            tarjeta de una pregunta del historial
      ui/                 EmptyState, ErrorBanner, Pagination y Skeleton
    hooks/                useChat, useDocuments, useHistory, useTituloPagina, useFocusTrap
    pages/                ChatPage, DocumentsPage, HistoryPage y NotFoundPage
    utils/                formato de fechas y números, validación de archivos
```

Las pruebas (`*.test.ts`, `*.test.tsx`) viven junto al código que prueban.

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
