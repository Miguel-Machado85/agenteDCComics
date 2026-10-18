import type { ParamsPaginacion } from './chat'
import { apiFetch } from './client'
import type { DocumentoSubido, ListaDocumentos } from './types'

// La ingesta extrae el texto y genera los embeddings en el momento
const TIMEOUT_SUBIDA_MS = 300_000

/** POST /documents (multipart, campo "archivo"). */
export function subirDocumento(archivo: File, signal?: AbortSignal): Promise<DocumentoSubido> {
  const form = new FormData()
  form.append('archivo', archivo)
  return apiFetch<DocumentoSubido>('/documents', {
    method: 'POST',
    body: form,
    timeoutMs: TIMEOUT_SUBIDA_MS,
    signal,
  })
}

export interface ParamsDocumentos extends ParamsPaginacion {
  /** 'upload' o el de la wiki; sin filtro si se omite. */
  source?: string
}

/** GET /documents: todos los usuarios, mas recientes primero. */
export function listarDocumentos(
  { source, limit = 20, offset = 0 }: ParamsDocumentos = {},
  signal?: AbortSignal,
): Promise<ListaDocumentos> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (source) query.set('source', source)
  return apiFetch<ListaDocumentos>(`/documents?${query}`, { signal })
}

/** DELETE /documents/{id}: 204 sin cuerpo. */
export function borrarDocumento(id: number): Promise<void> {
  return apiFetch<void>(`/documents/${id}`, { method: 'DELETE' })
}
