import { config } from '../config'
import { apiFetch } from './client'
import type { EntradaHistorial, PreguntaIn, RespuestaChat } from './types'

/** POST /chat */
export function enviarPregunta(pregunta: string, signal?: AbortSignal): Promise<RespuestaChat> {
  const body: PreguntaIn = { pregunta }
  return apiFetch<RespuestaChat>('/chat', {
    method: 'POST',
    body,
    // En la EC2 una pregunta puede pasar de 3 min y Ollama atiende una a la vez
    timeoutMs: config.chatTimeoutS * 1000,
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
