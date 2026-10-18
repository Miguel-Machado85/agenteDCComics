import { useId, useState } from 'react'
import type { Fuente } from '../../api/types'
import SourceCard from './SourceCard'

export default function SourcesPanel({ fuentes }: { fuentes: Fuente[] }) {
  const [abierto, setAbierto] = useState(false)
  const idLista = useId()
  if (fuentes.length === 0) return null

  return (
    <div className="mt-3 border-t border-borde pt-2">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={idLista}
        className="flex items-center gap-1 text-sm font-medium text-acento-fuerte hover:underline"
      >
        <span aria-hidden="true">{abierto ? '▾' : '▸'}</span>
        {fuentes.length === 1 ? '1 fuente' : `${fuentes.length} fuentes`}
      </button>
      {abierto && (
        <ul id={idLista} className="mt-2 space-y-2">
          {fuentes.map((f, i) => (
            <SourceCard key={`${f.document_id}-${i}`} fuente={f} />
          ))}
        </ul>
      )}
    </div>
  )
}
