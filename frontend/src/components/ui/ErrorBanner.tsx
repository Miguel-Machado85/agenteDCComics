interface Props {
  mensaje: string
  /** Texto en negrita antes del mensaje (p. ej. "No se pudo cargar el historial"). */
  titulo?: string
  /** Si se pasa, muestra el botón Reintentar. */
  onReintentar?: () => void
  className?: string
}

/** Aviso de error para fallos al cargar datos, con Reintentar opcional. */
export default function ErrorBanner({ mensaje, titulo, onReintentar, className = '' }: Props) {
  return (
    <div
      role="alert"
      className={`rounded-md border border-peligro/60 bg-peligro/10 px-3 py-3 text-sm ${className}`}
    >
      {titulo && <p className="font-semibold text-peligro">{titulo}</p>}
      <p className={titulo ? 'mt-0.5 text-texto' : 'text-peligro'}>{mensaje}</p>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="mt-2 rounded-md border border-peligro/60 px-3 py-1.5 font-medium text-peligro hover:bg-peligro/20"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}
