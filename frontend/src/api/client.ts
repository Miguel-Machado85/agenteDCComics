/**
 * Wrapper de fetch para la API: antepone config.apiUrl, agrega el token,
 * aplica un timeout y convierte cualquier fallo en ApiError con un mensaje en
 * espanol listo para mostrar.
 */
import { getToken, login, refreshToken } from '../auth/keycloak'
import { config } from '../config'
import type { ErrorValidacion } from './types'

const TIMEOUT_POR_DEFECTO_MS = 30_000

export const MENSAJE_SIN_CONEXION =
  'No se pudo conectar con el servidor. Revisa que el backend esté encendido.'
export const MENSAJE_TIMEOUT =
  'El agente tardó demasiado en responder. Intenta de nuevo.'
const MENSAJE_CANCELADA = 'Se canceló la solicitud.'

const MENSAJES_POR_CODIGO: Record<number, string> = {
  400: 'La solicitud no es válida.',
  401: 'Tu sesión expiró. Inicia sesión de nuevo.',
  403: 'No tienes permiso para hacer esto.',
  404: 'No se encontró el recurso solicitado.',
  408: MENSAJE_TIMEOUT,
  413: 'El archivo es demasiado grande.',
  415: 'Formato de archivo no soportado.',
  422: 'Los datos enviados no son válidos.',
  500: 'Error interno del servidor.',
  502: 'El servidor no está disponible en este momento.',
  503: 'El servicio no está disponible en este momento. Intenta más tarde.',
  504: 'El servidor tardó demasiado en responder.',
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, mensaje: string) {
    super(mensaje)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface OpcionesApi extends Omit<RequestInit, 'body' | 'signal'> {
  /** Un objeto plano se envia como JSON; FormData y demas BodyInit tal cual. */
  body?: BodyInit | object | null
  /** Por defecto 30 s. */
  timeoutMs?: number
  /** Senal externa para cancelar (p. ej. al desmontar o con un boton). */
  signal?: AbortSignal
  /** false para rutas publicas (/health): no pide token. Por defecto true. */
  auth?: boolean
}

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  if (valor === null || typeof valor !== 'object') return false
  const proto = Object.getPrototypeOf(valor)
  return proto === Object.prototype || proto === null
}

function mensajeGenerico(status: number): string {
  return MENSAJES_POR_CODIGO[status] ?? `Error inesperado del servidor (${status}).`
}

/** detail string -> tal cual; arreglo de Pydantic -> los msg unidos. */
function mensajeDeDetail(detail: unknown): string | null {
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const msgs = (detail as Partial<ErrorValidacion>[])
      .map((d) => d?.msg)
      .filter((m): m is string => typeof m === 'string' && m.trim() !== '')
    if (msgs.length) return msgs.join('. ')
  }
  return null
}

async function errorDeRespuesta(res: Response): Promise<ApiError> {
  let detail: unknown
  try {
    detail = ((await res.json()) as { detail?: unknown })?.detail
  } catch {
    // Sin cuerpo JSON (p. ej. un 502 del proxy): mensaje generico
  }
  return new ApiError(res.status, mensajeDeDetail(detail) ?? mensajeGenerico(res.status))
}

function esAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

/** true si el error viene de cancelar con la senal externa (no hay que mostrarlo). */
export function esCancelacion(e: unknown): boolean {
  return esAbortError(e)
}

/**
 * Un intento de fetch con su propio timeout. La senal externa aborta el mismo
 * controller; el flag distingue el timeout (408) de una cancelacion.
 */
async function fetchConTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externa?: AbortSignal,
): Promise<Response> {
  if (externa?.aborted) throw new DOMException(MENSAJE_CANCELADA, 'AbortError')

  const controller = new AbortController()
  let porTimeout = false
  const timer = setTimeout(() => {
    porTimeout = true
    controller.abort()
  }, timeoutMs)
  const alCancelar = () => controller.abort()
  externa?.addEventListener('abort', alCancelar, { once: true })

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    if (porTimeout) throw new ApiError(408, MENSAJE_TIMEOUT)
    if (esAbortError(e)) throw new DOMException(MENSAJE_CANCELADA, 'AbortError')
    // fetch lanza TypeError cuando no hay red, el servidor esta apagado o CORS falla
    if (e instanceof TypeError) throw new ApiError(0, MENSAJE_SIN_CONEXION)
    throw e
  } finally {
    clearTimeout(timer)
    externa?.removeEventListener('abort', alCancelar)
  }
}

/**
 * Llama a la API y devuelve el JSON tipado (undefined en un 204).
 * Ante un 401 renueva el token y reintenta una sola vez; si vuelve a fallar,
 * redirige al login.
 */
export async function apiFetch<T>(ruta: string, opciones: OpcionesApi = {}): Promise<T> {
  const {
    body,
    timeoutMs = TIMEOUT_POR_DEFECTO_MS,
    signal,
    auth = true,
    headers,
    ...resto
  } = opciones

  const url = `${config.apiUrl}${ruta.startsWith('/') ? ruta : `/${ruta}`}`
  const base = new Headers(headers)
  let cuerpo: BodyInit | null | undefined
  if (esObjetoPlano(body)) {
    base.set('Content-Type', 'application/json')
    cuerpo = JSON.stringify(body)
  } else {
    // FormData: sin Content-Type, el navegador pone el boundary
    cuerpo = body as BodyInit | null | undefined
  }

  const intentar = async (token: string | null) => {
    const h = new Headers(base)
    if (token) h.set('Authorization', `Bearer ${token}`)
    return fetchConTimeout(url, { ...resto, headers: h, body: cuerpo }, timeoutMs, signal)
  }

  let res = await intentar(auth ? await getToken() : null)

  if (res.status === 401 && auth) {
    if (await refreshToken()) {
      res = await intentar(await getToken())
    }
    if (res.status === 401) {
      void login()
      throw await errorDeRespuesta(res)
    }
  }

  if (!res.ok) throw await errorDeRespuesta(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Texto para mostrar en la UI a partir de cualquier error. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (esAbortError(e)) return MENSAJE_CANCELADA
  if (e instanceof TypeError) return MENSAJE_SIN_CONEXION
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string' && e) return e
  return 'Ocurrió un error inesperado.'
}
