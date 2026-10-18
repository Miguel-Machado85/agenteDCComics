import { useEffect, useState } from 'react'

const AVISO_LENTO_S = 20

/** Se monta solo mientras se espera la respuesta: el contador arranca en 0. */
export default function ThinkingIndicator() {
  const [segundos, setSegundos] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div role="status" className="flex items-center gap-2 px-1 text-sm text-texto-suave">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-acento" aria-hidden="true" />
      <span>
        SuperBot está revisando sus archivos…
        {/* El contador cambia cada segundo: oculto para no saturar al lector de pantalla */}
        <span aria-hidden="true"> {segundos} s</span>
        {segundos >= AVISO_LENTO_S && (
          <span className="block">
            En el servidor puede tardar varios minutos; no cierres ni recargues la página
          </span>
        )}
      </span>
    </div>
  )
}
