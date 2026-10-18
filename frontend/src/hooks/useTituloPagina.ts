import { useEffect } from 'react'

const NOMBRE_APP = 'Agente DC Comics'

/** Pone el título de la pestaña: "Chat · Agente DC Comics". */
export function useTituloPagina(titulo: string) {
  useEffect(() => {
    document.title = `${titulo} · ${NOMBRE_APP}`
  }, [titulo])
}
