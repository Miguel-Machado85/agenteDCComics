# Frontend — Agente DC Comics

SPA que consume la API FastAPI de `/backend` (agente RAG sobre DC Comics) con login en Keycloak.

## Stack

- React 18 + Vite 8 + TypeScript (plantilla `react-ts` de create-vite)
- react-router-dom (rutas `/chat`, `/documentos`, `/historial`, 404; `/` redirige a `/chat`)
- Tailwind CSS v4 con `@tailwindcss/vite` (tokens del tema en `src/index.css`, bloque `@theme`: `bg-fondo`, `bg-superficie`, `border-borde`, `text-texto`, `text-texto-suave`, `text-acento`, `text-acento-fuerte`, `text-peligro`, `text-exito`, `text-aviso`)
- keycloak-js 26 (misma versión mayor que el servidor Keycloak)
- Sin axios: `fetch` con un wrapper propio en `src/api/client.ts`
- Lint con oxlint (`.oxlintrc.json`), no ESLint
- Desarrollo en Windows con PowerShell

## Variables de entorno

No hay `.env` dentro de `/frontend`. `vite.config.ts` usa `envDir: '..'`: las variables se leen del `.env` de la **raíz** del repo (plantilla en `/.env.example`). Solo las `VITE_*` llegan al navegador; nunca poner secretos con ese prefijo.

| Variable | Valor local |
|---|---|
| `VITE_API_URL` | `http://localhost:8000` |
| `VITE_KEYCLOAK_URL` | `http://localhost:8080` |
| `VITE_KEYCLOAK_REALM` | `dc-comics` |
| `VITE_KEYCLOAK_CLIENT_ID` | `dc-frontend` |

Se usa `localhost` (no `127.0.0.1`) porque el issuer del token debe coincidir con `KEYCLOAK_ISSUER` del backend (`http://localhost:8080/realms/dc-comics`). `src/config.ts` valida las cuatro al arrancar y exporta `config` (`apiUrl`, `keycloakUrl`, `keycloakRealm`, `keycloakClientId`); nunca leer `import.meta.env` en otro sitio.

El dev server corre en `localhost:5173` con `strictPort`: Keycloak (`redirectUris: http://localhost:5173/*`, `webOrigins`) y el CORS del backend (`CORS_ORIGINS`) solo aceptan ese origen.

## Keycloak (realm `dc-comics`)

- Cliente `dc-frontend`: público (sin secret), Authorization Code + PKCE `S256`, sin implicit flow.
- El backend exige firma RS256, `iss = http://localhost:8080/realms/dc-comics` y `aud = dc-api`.
- Registro de usuarios habilitado. Usuario de prueba: `demo` / `demo`.
- El access token dura 5 minutos.

## Contrato de la API

Base: `VITE_API_URL`. Todas las rutas exigen `Authorization: Bearer <token>` salvo `/health`. Claves JSON en español. Fechas en ISO 8601. Tipos TS en `src/api/types.ts` (espejo de `backend/app/schemas.py`).

| Método y ruta | Cuerpo / parámetros | Respuesta OK | Errores |
|---|---|---|---|
| `GET /health` (público) | — | 200 `{"status": "ok"}` | — |
| `POST /chat` | JSON `{"pregunta": string}` (1–2000 caracteres) | 200 `RespuestaChat` | 401 sin token / token inválido o expirado · 422 validación · 503 LLM no responde o falló, Keycloak no responde, base de datos no responde |
| `GET /history` | query `limit` 1–100 (def. 20), `offset` ≥ 0 (def. 0) | 200 `EntradaHistorial[]`, **lo más reciente primero**, solo del usuario del token | 401 · 422 · 503 |
| `POST /documents` | `multipart/form-data`, campo **`archivo`**. Formatos `.pdf .txt .md .csv .docx`; máximo `MAX_UPLOAD_MB` (10 MB por defecto) | 201 `DocumentoSubido` | 401 · 413 archivo muy grande · 415 formato no soportado · 422 sin texto extraíble (o falta el campo) · 503 |
| `GET /documents` | query `source` opcional (`upload` o el de la wiki), `limit` 1–100 (def. 20), `offset` ≥ 0 | 200 `ListaDocumentos` (todos los usuarios, más recientes primero; hay miles de páginas de la wiki: paginar siempre) | 401 · 422 · 503 |
| `DELETE /documents/{id}` | — | 204 sin cuerpo | 401 · 403 no es un `upload` o no lo subió este usuario · 404 no existe · 503 |

Subir el mismo archivo otra vez (mismo usuario) reemplaza el documento anterior.

### Modelos

```ts
Fuente           { document_id: number; titulo: string; url: string | null; seccion: string | null; similitud: number; fragmento: string }
RespuestaChat    { respuesta: string; rechazada: boolean; intencion: string; fuentes: Fuente[]; historial_id: number }
EntradaHistorial { id: number; pregunta: string; respuesta: string; rechazada: boolean; fuentes: Fuente[]; creado: string }
DocumentoSubido  { id: number; titulo: string; chunks: number; mensaje: string }
DocumentoItem    { id: number; titulo: string; source: string; url: string | null; uploaded_by: string | null; chunks: number; creado: string }
ListaDocumentos  { total: number; items: DocumentoItem[] }
```

`uploaded_by` es el `sub` del token (no el username): sirve para saber si un documento es del usuario actual.

### Errores

- `{"detail": string}` en todos los casos (mensaje en español listo para mostrar)...
- ...salvo el 422 de validación de Pydantic, donde `detail` es un arreglo `[{loc, msg, type}]`.
- Los 401 traen `WWW-Authenticate: Bearer`.

## Reglas fijas

- `POST /documents` usa multipart con el campo `"archivo"`; no fijar `Content-Type` a mano (el navegador pone el boundary).
- `GET /history` devuelve lo más reciente primero.
- Los errores llegan como `{"detail": string}`, salvo el 422 de Pydantic, donde `detail` es un arreglo.
- El token dura 5 min: siempre `updateToken` antes de cada request.
- Una pregunta al agente tarda 15–50 s en CPU: timeout de 180 s.
- El mensaje de rechazo es fijo y lo decide el backend (campo `rechazada`); el front no lo inventa.
- No tocar `/backend`, `/deploy` ni `/keycloak` desde el frontend.
- Textos de la interfaz en español.
- Identidad visual solo con color y tipografía: sin logos ni personajes oficiales de DC.

## Estructura

```
src/
  main.tsx, App.tsx, config.ts, index.css, vite-env.d.ts
  auth/        keycloak.ts, AuthContext.tsx
  api/         client.ts (wrapper fetch), types.ts, chat.ts, documents.ts
  components/  layout/ (Layout, Header, NavBar), chat/, documents/, ui/
  pages/       ChatPage, DocumentsPage, HistoryPage, NotFoundPage
  hooks/, utils/ (formato.ts)
public/_redirects   fallback SPA para Netlify (/* /index.html 200)
```

## Comandos (desde `/frontend`)

```powershell
npm install
npm run dev     # http://localhost:5173
npm run build   # tsc -b + vite build -> dist/
npm run lint    # oxlint
npm test        # vitest run (pruebas *.test.ts y *.test.tsx junto al código; las de componentes usan jsdom + Testing Library)
```
