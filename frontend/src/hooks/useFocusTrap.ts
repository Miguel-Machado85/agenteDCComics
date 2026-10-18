import { useEffect, useRef, type RefObject } from 'react'

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Atrapa el foco dentro del contenedor mientras esta montado: enfoca
 * `inicial` (o el primer enfocable), Tab/Shift+Tab ciclan, Esc llama a
 * onEscape y al desmontar devuelve el foco a donde estaba.
 */
export function useFocusTrap(
  contenedor: RefObject<HTMLElement | null>,
  onEscape: () => void,
  inicial?: RefObject<HTMLElement | null>,
) {
  // Ref para no reinstalar los listeners cuando cambia la funcion
  const onEscapeRef = useRef(onEscape)
  useEffect(() => {
    onEscapeRef.current = onEscape
  })

  useEffect(() => {
    const nodo = contenedor.current
    if (!nodo) return
    const previo = document.activeElement as HTMLElement | null

    const enfocables = () => Array.from(nodo.querySelectorAll<HTMLElement>(ENFOCABLES))
    ;(inicial?.current ?? enfocables()[0] ?? nodo).focus()

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onEscapeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const lista = enfocables()
      if (lista.length === 0) {
        e.preventDefault()
        return
      }
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      const activo = document.activeElement
      if (e.shiftKey && (activo === primero || !nodo.contains(activo))) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (activo === ultimo || !nodo.contains(activo))) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      previo?.focus?.()
    }
  }, [contenedor, inicial])
}
