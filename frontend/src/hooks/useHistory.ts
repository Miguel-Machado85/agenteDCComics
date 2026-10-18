import { useCallback, useEffect, useState } from 'react'
import { obtenerHistorial } from '../api/chat'
import { esCancelacion, mensajeDeError } from '../api/client'
import type { EntradaHistorial } from '../api/types'

export const LIMITE_HISTORIAL = 20

/**
 * Historial paginado del usuario. GET /history no devuelve el total: se sabe
 * que hay otra pagina si esta vino llena. Si la siguiente resulta vacia (el
 * total era multiplo exacto del limite), retrocede y la marca como la ultima.
 */
export function useHistory() {
  const [pagina, setPagina] = useState(1)
  const [items, setItems] = useState<EntradaHistorial[]>([])
  const [ultimaPagina, setUltimaPagina] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Cambiarlo fuerza una nueva carga aunque la pagina no cambie
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    obtenerHistorial(
      { limit: LIMITE_HISTORIAL, offset: (pagina - 1) * LIMITE_HISTORIAL },
      controller.signal,
    )
      .then((entradas) => {
        if (entradas.length === 0 && pagina > 1) {
          setUltimaPagina(pagina - 1)
          setPagina(pagina - 1)
          return
        }
        setItems(entradas)
        if (entradas.length < LIMITE_HISTORIAL) setUltimaPagina(pagina)
        setCargando(false)
      })
      .catch((e: unknown) => {
        if (esCancelacion(e)) return
        setError(mensajeDeError(e))
        setCargando(false)
      })

    return () => controller.abort()
  }, [pagina, version])

  const irAPagina = useCallback((n: number) => {
    setCargando(true)
    setError(null)
    setPagina(Math.max(1, n))
  }, [])

  const recargar = useCallback(() => {
    setCargando(true)
    setError(null)
    setUltimaPagina(null)
    setVersion((v) => v + 1)
  }, [])

  const haySiguiente =
    items.length === LIMITE_HISTORIAL && (ultimaPagina === null || pagina < ultimaPagina)

  return { pagina, items, haySiguiente, cargando, error, irAPagina, recargar }
}
