import { useEffect } from 'react'

const NOMBRE_APP = 'SuperBot · DC Comics'

/** Pone el título de la pestaña: "Chat · SuperBot · DC Comics". */
export function useTituloPagina(titulo: string) {
  useEffect(() => {
    document.title = `${titulo} · ${NOMBRE_APP}`
  }, [titulo])
}
