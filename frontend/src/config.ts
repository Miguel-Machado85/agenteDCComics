/**
 * Configuracion del frontend. Las variables viven en el .env de la RAIZ del
 * repo (vite.config.ts -> envDir: '..'). Si falta alguna obligatoria, la app
 * no arranca.
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

const CHAT_TIMEOUT_POR_DEFECTO_S = 600

/** Segundos de VITE_CHAT_TIMEOUT_S: vacia -> 600; si no es un entero > 0, la app no arranca. */
export function leerSegundos(valor: string | undefined, porDefecto = CHAT_TIMEOUT_POR_DEFECTO_S): number {
  const texto = valor?.trim()
  if (!texto) return porDefecto
  const segundos = Number(texto)
  if (!Number.isInteger(segundos) || segundos <= 0) {
    throw new Error(
      `VITE_CHAT_TIMEOUT_S debe ser un entero mayor que 0 (segundos); llego "${texto}".`,
    )
  }
  return segundos
}

const sinBarraFinal = (url: string) => url.replace(/\/+$/, '')

export interface Config {
  apiUrl: string
  keycloakUrl: string
  keycloakRealm: string
  keycloakClientId: string
  /** Espera maxima de POST /chat, en segundos. */
  chatTimeoutS: number
}

export const config: Readonly<Config> = Object.freeze({
  apiUrl: sinBarraFinal(leer('VITE_API_URL')),
  keycloakUrl: sinBarraFinal(leer('VITE_KEYCLOAK_URL')),
  keycloakRealm: leer('VITE_KEYCLOAK_REALM'),
  keycloakClientId: leer('VITE_KEYCLOAK_CLIENT_ID'),
  chatTimeoutS: leerSegundos(import.meta.env.VITE_CHAT_TIMEOUT_S),
})
