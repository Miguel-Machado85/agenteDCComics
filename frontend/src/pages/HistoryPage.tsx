import { useRef } from 'react'
import { Link } from 'react-router-dom'
import HistoryCard from '../components/history/HistoryCard'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'
import Pagination from '../components/ui/Pagination'
import { SkeletonLista } from '../components/ui/Skeleton'
import { useHistory } from '../hooks/useHistory'
import { useTituloPagina } from '../hooks/useTituloPagina'

export default function HistoryPage() {
  useTituloPagina('Historial')
  const historial = useHistory()
  const inicioRef = useRef<HTMLDivElement>(null)
  const { items, cargando, error, pagina } = historial

  let contenido
  if (error) {
    contenido = (
      <ErrorBanner
        titulo="No se pudo cargar el historial"
        mensaje={error}
        onReintentar={historial.recargar}
      />
    )
  } else if (cargando && items.length === 0) {
    contenido = <SkeletonLista etiqueta="Cargando historial…" />
  } else if (items.length === 0) {
    contenido = (
      <EmptyState
        titulo="Todavía no has hecho preguntas"
        descripcion="Lo que le preguntes al agente aparecerá aquí con su respuesta y sus fuentes."
      >
        <Link
          to="/chat"
          className="inline-block rounded-md bg-acento px-4 py-2 text-sm font-medium text-white no-underline hover:bg-acento-fuerte"
        >
          Ir al chat
        </Link>
      </EmptyState>
    )
  } else {
    contenido = (
      <>
        <ul className={`flex flex-col gap-3 ${cargando ? 'opacity-60 transition-opacity' : ''}`}>
          {items.map((entrada) => (
            <HistoryCard key={entrada.id} entrada={entrada} />
          ))}
        </ul>
        <Pagination
          pagina={pagina}
          haySiguiente={historial.haySiguiente}
          onCambiar={(n) => {
            historial.irAPagina(n)
            // jsdom no implementa scrollIntoView
            inicioRef.current?.scrollIntoView?.({ block: 'start' })
          }}
          deshabilitado={cargando}
        />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div ref={inicioRef} className="scroll-mt-4">
        <h1 className="text-2xl font-semibold">Historial</h1>
        <p className="mt-1 text-sm text-texto-suave">Tus preguntas al agente, de la más reciente a la más antigua.</p>
      </div>
      <section aria-label="Preguntas anteriores" aria-busy={cargando} className="flex flex-col gap-4">
        {contenido}
      </section>
    </div>
  )
}
