import { useLayoutEffect, useRef, useState } from 'react'
import type { EntradaHistorial } from '../../api/types'
import { formatearFecha } from '../../utils/formato'
import SourcesPanel from '../chat/SourcesPanel'

export default function HistoryCard({ entrada }: { entrada: EntradaHistorial }) {
  const [expandida, setExpandida] = useState(false)
  // Solo se ofrece "ver más" si el texto no cabe en las 3 lineas
  const [desborda, setDesborda] = useState(false)
  const respuestaRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const el = respuestaRef.current
    if (!el || expandida) return
    const medir = () => setDesborda(el.scrollHeight > el.clientHeight + 1)
    medir()
    // El ancho cambia al girar el movil o redimensionar: se vuelve a medir
    if (typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [expandida, entrada.respuesta])

  return (
    <li className="rounded-lg border border-borde bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
        <time dateTime={entrada.creado}>{formatearFecha(entrada.creado)}</time>
        {entrada.rechazada && (
          <span className="rounded-full border border-aviso/60 bg-aviso/10 px-2 py-0.5 font-medium text-aviso">
            Rechazada
          </span>
        )}
      </div>

      <p className="mt-2 font-semibold break-words whitespace-pre-wrap text-texto">{entrada.pregunta}</p>

      <p
        ref={respuestaRef}
        className={`mt-1 break-words whitespace-pre-wrap text-texto-suave ${expandida ? '' : 'line-clamp-3'}`}
      >
        {entrada.respuesta}
      </p>
      {(desborda || expandida) && (
        <button
          type="button"
          onClick={() => setExpandida((v) => !v)}
          aria-expanded={expandida}
          className="mt-1 text-sm font-medium text-acento-fuerte hover:underline"
        >
          {expandida ? 'ver menos' : 'ver más'}
        </button>
      )}

      <SourcesPanel fuentes={entrada.fuentes} />
    </li>
  )
}
