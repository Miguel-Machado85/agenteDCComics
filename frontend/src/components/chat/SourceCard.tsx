import { useState } from 'react'
import type { Fuente } from '../../api/types'
import { nivelSimilitud, similitudAPorcentaje, type NivelSimilitud } from '../../utils/formato'

// Por debajo de esto el fragmento cabe en tres lineas: no hace falta "ver más"
const FRAGMENTO_LARGO = 180

const COLOR_NIVEL: Record<NivelSimilitud, string> = {
  fuerte: 'border-exito/40 bg-exito/10 text-exito',
  aceptable: 'border-aviso/40 bg-aviso/10 text-aviso',
  débil: 'border-borde bg-superficie text-texto-suave',
}

export default function SourceCard({ fuente }: { fuente: Fuente }) {
  const [expandido, setExpandido] = useState(false)
  const nivel = nivelSimilitud(fuente.similitud)
  const largo = fuente.fragmento.length > FRAGMENTO_LARGO

  return (
    <li className="rounded-md border border-borde bg-superficie p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold break-words text-texto">{fuente.titulo}</p>
          {fuente.seccion && <p className="text-xs text-texto-suave">{fuente.seccion}</p>}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${COLOR_NIVEL[nivel]}`}
          title="Similitud con la pregunta"
        >
          {similitudAPorcentaje(fuente.similitud)} · {nivel}
        </span>
      </div>

      <p
        className={`mt-2 whitespace-pre-wrap text-texto-suave ${largo && !expandido ? 'line-clamp-3' : ''}`}
      >
        {fuente.fragmento}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
        {largo && (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            aria-expanded={expandido}
            className="font-medium text-acento-fuerte hover:underline"
          >
            {expandido ? 'ver menos' : 'ver más'}
          </button>
        )}
        {fuente.url && (
          <a href={fuente.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            Abrir fuente ↗
          </a>
        )}
      </div>
    </li>
  )
}
