import { useRef, type KeyboardEvent } from 'react'
import type { SourceDocumentos } from '../../hooks/useDocuments'

const PESTANAS: { source: SourceDocumentos; etiqueta: string }[] = [
  { source: 'upload', etiqueta: 'Subidos' },
  { source: 'dc_wiki', etiqueta: 'Wiki' },
]

interface Props {
  activa: SourceDocumentos
  onCambiar: (source: SourceDocumentos) => void
  /** id del tabpanel que controlan las pestanas. */
  panelId: string
}

export default function DocumentTabs({ activa, onCambiar, panelId }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function alTeclear(e: KeyboardEvent, i: number) {
    const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!paso) return
    e.preventDefault()
    const siguiente = (i + paso + PESTANAS.length) % PESTANAS.length
    refs.current[siguiente]?.focus()
    onCambiar(PESTANAS[siguiente].source)
  }

  return (
    <div role="tablist" aria-label="Origen de los documentos" className="flex gap-1 border-b border-borde">
      {PESTANAS.map((p, i) => {
        const seleccionada = p.source === activa
        return (
          <button
            key={p.source}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`pestana-${p.source}`}
            aria-selected={seleccionada}
            aria-controls={panelId}
            tabIndex={seleccionada ? 0 : -1}
            onClick={() => onCambiar(p.source)}
            onKeyDown={(e) => alTeclear(e, i)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              seleccionada
                ? 'border-acento-fuerte text-texto'
                : 'border-transparent text-texto-suave hover:text-texto'
            }`}
          >
            {p.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
