/** Bloque gris animado que ocupa el lugar del contenido mientras carga. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-superficie-alta ${className}`} />
}

interface PropsLista {
  /** Número de tarjetas de relleno. */
  filas?: number
  /** Texto para lectores de pantalla. */
  etiqueta?: string
}

/** Lista de tarjetas de relleno con el mismo aspecto que las tarjetas reales. */
export function SkeletonLista({ filas = 5, etiqueta = 'Cargando…' }: PropsLista) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{etiqueta}</span>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="rounded-lg border border-borde bg-superficie p-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-5/6" />
        </div>
      ))}
    </div>
  )
}
