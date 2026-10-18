import { apiFetch } from './client'
import type { EntradaHistorial, PreguntaIn, RespuestaChat } from './types'

// Una pregunta tarda 15–50 s en CPU: margen amplio
const TIMEOUT_CHAT_MS = 180_000

/** POST /chat */
export function enviarPregunta(pregunta: string, signal?: AbortSignal): Promise<RespuestaChat> {
  const body: PreguntaIn = { pregunta }
  return apiFetch<RespuestaChat>('/chat', {
    method: 'POST',
    body,
    timeoutMs: TIMEOUT_CHAT_MS,
    signal,
  })
}

export interface ParamsPaginacion {
  /** 1–100 (def. 20). */
  limit?: number
  /** ≥ 0 (def. 0). */
  offset?: number
}

/** GET /history: lo mas reciente primero, solo del usuario del token. */
export function obtenerHistorial(
  { limit = 20, offset = 0 }: ParamsPaginacion = {},
  signal?: AbortSignal,
): Promise<EntradaHistorial[]> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  return apiFetch<EntradaHistorial[]>(`/history?${query}`, { signal })
}
