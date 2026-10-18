interface Props {
  pagina: number
  /** Total conocido: muestra "Página X de Y". */
  totalPaginas?: number
  /** Sin total (p. ej. GET /history): indica si existe una página siguiente. */
  haySiguiente?: boolean
  onCambiar: (pagina: number) => void
  deshabilitado?: boolean
}

const BOTON =
  'shrink-0 rounded-md border border-borde px-3 py-1.5 text-sm font-medium transition-colors hover:bg-superficie-alta disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'

/** Anterior / "Página X de Y" / Siguiente. No se muestra con una sola pagina. */
export default function Pagination({
  pagina,
  totalPaginas,
  haySiguiente,
  onCambiar,
  deshabilitado = false,
}: Props) {
  const siguiente = totalPaginas !== undefined ? pagina < totalPaginas : Boolean(haySiguiente)
  if (pagina <= 1 && !siguiente) return null

  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-2">
      <button
        type="button"
        className={BOTON}
        onClick={() => onCambiar(pagina - 1)}
        disabled={deshabilitado || pagina <= 1}
      >
        <span aria-hidden="true">← </span>Anterior
      </button>
      <p className="min-w-0 text-center text-sm text-texto-suave" aria-live="polite">
        Página {pagina}
        {totalPaginas !== undefined && ` de ${totalPaginas}`}
      </p>
      <button
        type="button"
        className={BOTON}
        onClick={() => onCambiar(pagina + 1)}
        disabled={deshabilitado || !siguiente}
      >
        Siguiente<span aria-hidden="true"> →</span>
      </button>
    </nav>
  )
}
