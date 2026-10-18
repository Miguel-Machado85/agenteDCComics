/**
 * Tipos del contrato de la API (espejo de backend/app/schemas.py).
 * Las fechas (datetime en Pydantic) llegan como string ISO 8601.
 */

export interface PreguntaIn {
  /** 1–2000 caracteres. */
  pregunta: string
}

export interface Fuente {
  document_id: number
  titulo: string
  url: string | null
  seccion: string | null
  similitud: number
  fragmento: string
}

export interface RespuestaChat {
  respuesta: string
  rechazada: boolean
  /** El backend lo tipa como str: 'pregunta', 'saludo' o 'ambigua' (backend/app/agent/nodos.py). */
  intencion: string
  fuentes: Fuente[]
  historial_id: number
}

export interface EntradaHistorial {
  id: number
  pregunta: string
  respuesta: string
  rechazada: boolean
  fuentes: Fuente[]
  creado: string
}

export interface DocumentoSubido {
  id: number
  titulo: string
  chunks: number
  mensaje: string
}

export interface DocumentoItem {
  id: number
  titulo: string
  source: string
  url: string | null
  /** `sub` del token de quien lo subio (null en las paginas de la wiki). */
  uploaded_by: string | null
  chunks: number
  creado: string
}

export interface ListaDocumentos {
  total: number
  items: DocumentoItem[]
}

/** Error de validacion de Pydantic (422): detail es un arreglo. */
export interface ErrorValidacion {
  loc: (string | number)[]
  msg: string
  type: string
}
