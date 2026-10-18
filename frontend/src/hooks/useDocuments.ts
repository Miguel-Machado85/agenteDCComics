import { useCallback, useEffect, useState } from 'react'
import { esCancelacion, mensajeDeError } from '../api/client'
import { listarDocumentos } from '../api/documents'
import type { DocumentoItem } from '../api/types'

/** Valores reales de documents.source (backend/scripts/wiki/cargarPgvector.py). */
export type SourceDocumentos = 'upload' | 'dc_wiki'

export const LIMITE_DOCUMENTOS = 20

/**
 * Lista paginada de documentos filtrada por source. Cada cambio de pestana o
 * pagina cancela la carga anterior; recargar() vuelve a pedir la pagina actual.
 */
export function useDocuments(sourceInicial: SourceDocumentos = 'upload') {
  const [source, setSource] = useState<SourceDocumentos>(sourceInicial)
  const [pagina, setPagina] = useState(1)
  const [items, setItems] = useState<DocumentoItem[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Cambiarlo fuerza una nueva carga aunque source y pagina no cambien
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    listarDocumentos(
      { source, limit: LIMITE_DOCUMENTOS, offset: (pagina - 1) * LIMITE_DOCUMENTOS },
      controller.signal,
    )
      .then((lista) => {
        // Pagina vacia (p. ej. se borro su ultimo documento): retrocede una
        if (lista.items.length === 0 && lista.total > 0 && pagina > 1) {
          setPagina(Math.max(1, Math.ceil(lista.total / LIMITE_DOCUMENTOS)))
          return
        }
        setItems(lista.items)
        setTotal(lista.total)
        setCargando(false)
      })
      .catch((e: unknown) => {
        if (esCancelacion(e)) return
        setError(mensajeDeError(e))
        setCargando(false)
      })

    return () => controller.abort()
  }, [source, pagina, version])

  // El estado de carga se marca desde el evento que la provoca, no en el efecto
  const iniciarCarga = () => {
    setCargando(true)
    setError(null)
  }

  const cambiarSource = useCallback(
    (nuevo: SourceDocumentos) => {
      iniciarCarga()
      // Otra pestana: no mostrar la lista anterior mientras carga
      if (nuevo !== source) {
        setItems([])
        setTotal(0)
      }
      setSource(nuevo)
      setPagina(1)
    },
    [source],
  )

  const irAPagina = useCallback((n: number) => {
    iniciarCarga()
    setPagina(Math.max(1, n))
  }, [])

  const recargar = useCallback(() => {
    iniciarCarga()
    setVersion((v) => v + 1)
  }, [])

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE_DOCUMENTOS))

  return {
    source,
    pagina,
    totalPaginas,
    total,
    items,
    cargando,
    error,
    cambiarSource,
    irAPagina,
    recargar,
  }
}
