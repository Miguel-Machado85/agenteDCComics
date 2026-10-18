/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_KEYCLOAK_URL: string
  readonly VITE_KEYCLOAK_REALM: string
  readonly VITE_KEYCLOAK_CLIENT_ID: string
  /** Opcional: segundos que se espera la respuesta de POST /chat (def. 600). */
  readonly VITE_CHAT_TIMEOUT_S?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
