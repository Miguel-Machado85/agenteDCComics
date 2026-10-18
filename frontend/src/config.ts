/**
 * Configuracion del frontend. Las variables viven en el .env de la RAIZ del
 * repo (vite.config.ts -> envDir: '..'). Si falta alguna, la app no arranca.
 */

type NombreVariable = keyof ImportMetaEnv

function leer(nombre: NombreVariable): string {
  const valor = import.meta.env[nombre]?.trim()
  if (!valor) {
    throw new Error(
      `Falta la variable ${nombre} en el .env de la raiz del repo (ver .env.example).`,
    )
  }
  return valor
}

const sinBarraFinal = (url: string) => url.replace(/\/+$/, '')

export interface Config {
  apiUrl: string
  keycloakUrl: string
  keycloakRealm: string
  keycloakClientId: string
}

export const config: Readonly<Config> = Object.freeze({
  apiUrl: sinBarraFinal(leer('VITE_API_URL')),
  keycloakUrl: sinBarraFinal(leer('VITE_KEYCLOAK_URL')),
  keycloakRealm: leer('VITE_KEYCLOAK_REALM'),
  keycloakClientId: leer('VITE_KEYCLOAK_CLIENT_ID'),
})
