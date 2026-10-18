/**
 * Instancia unica de keycloak-js. Solo la usan main.tsx y AuthContext:
 * las paginas acceden a la sesion con useAuth().
 */
import Keycloak from 'keycloak-js'
import { config } from '../config'

export const keycloak = new Keycloak({
  url: config.keycloakUrl,
  realm: config.keycloakRealm,
  clientId: config.keycloakClientId,
})

/** URL del realm: la que se muestra si no hay conexion. */
export const realmUrl = `${config.keycloakUrl}/realms/${config.keycloakRealm}`

// Margen (s) con el que se renueva el token antes de que expire
const MARGEN_REFRESH = 30
const TIMEOUT_CONEXION_MS = 8000

let promesaInit: Promise<boolean> | null = null

/**
 * keycloak-js no hace ninguna peticion en init() antes de redirigir al login:
 * si Keycloak esta apagado, el navegador mostraria su propia pagina de error.
 * Se comprueba antes que el servidor responde. 'no-cors' basta para saber si
 * hay conexion (la respuesta es opaca) y no depende de los headers CORS.
 */
async function comprobarConexion(): Promise<void> {
  await fetch(realmUrl, {
    mode: 'no-cors',
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_CONEXION_MS),
  })
}

/**
 * Inicializa Keycloak una sola vez y reutiliza la misma promesa en llamadas
 * siguientes (keycloak-js lanza error si se inicializa dos veces).
 */
export function initKeycloak(): Promise<boolean> {
  if (!promesaInit) {
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(MARGEN_REFRESH).catch(() => keycloak.login())
    }
    promesaInit = comprobarConexion().then(() =>
      keycloak.init({
        onLoad: 'login-required',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      }),
    )
  }
  return promesaInit
}

/**
 * Fuerza la renovacion del token aunque aun no expire (el backend lo rechazo
 * con 401). Devuelve false si no se pudo renovar.
 */
export async function refreshToken(): Promise<boolean> {
  try {
    await keycloak.updateToken(-1)
    return Boolean(keycloak.token)
  } catch {
    return false
  }
}

/** Redirige al login de Keycloak. */
export function login(): Promise<void> {
  return keycloak.login()
}

/** Devuelve un access token vigente (lo renueva si le quedan menos de 30 s). */
export async function getToken(): Promise<string> {
  try {
    await keycloak.updateToken(MARGEN_REFRESH)
  } catch {
    await keycloak.login()
    throw new Error('Tu sesión expiró. Redirigiendo al inicio de sesión…')
  }
  if (!keycloak.token) {
    await keycloak.login()
    throw new Error('No hay una sesión activa. Redirigiendo al inicio de sesión…')
  }
  return keycloak.token
}
