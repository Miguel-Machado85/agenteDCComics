import { useEffect, useRef } from 'react'
import type { Mensaje } from '../../hooks/useChat'
import ErrorBanner from '../ui/ErrorBanner'
import { Skeleton } from '../ui/Skeleton'
import MessageBubble from './MessageBubble'
import ThinkingIndicator from './ThinkingIndicator'

const EJEMPLOS = [
  '¿Quién es Aquaman?',
  '¿Quién creó a Batman?',
  '¿Cuáles son los poderes de Wonder Woman?',
  '¿Qué es la Liga de la Justicia?',
]

interface Props {
  mensajes: Mensaje[]
  enviando: boolean
  cargandoHistorial: boolean
  errorHistorial: string | null
  onEnviar: (pregunta: string) => void
  onReintentar: (idError: string) => void
  onRecargarHistorial: () => void
}

export default function ChatWindow({
  mensajes,
  enviando,
  cargandoHistorial,
  errorHistorial,
  onEnviar,
  onReintentar,
  onRecargarHistorial,
}: Props) {
  const finalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // jsdom no implementa scrollIntoView
    finalRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [mensajes, enviando])

  const vacio = !cargandoHistorial && mensajes.length === 0 && !enviando

  return (
    <div className="min-h-24 flex-1 overflow-y-auto rounded-lg border border-borde bg-fondo p-3 sm:p-4">
      {errorHistorial && (
        <ErrorBanner
          className="mb-4"
          titulo="No se pudo cargar la conversación anterior"
          mensaje={errorHistorial}
          onReintentar={onRecargarHistorial}
        />
      )}

      {cargandoHistorial && (
        <div role="status" className="mb-4 space-y-4">
          <span className="sr-only">Cargando conversación…</span>
          {['w-2/5', 'w-3/5', 'w-1/3', 'w-1/2'].map((ancho, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              <Skeleton className={`h-12 rounded-lg ${ancho}`} />
            </div>
          ))}
        </div>
      )}

      {vacio && (
        <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
          <p className="text-texto-suave">
            Pregunta lo que quieras sobre personajes, equipos e historia de DC Comics.
          </p>
          <ul className="flex flex-wrap justify-center gap-2">
            {EJEMPLOS.map((ejemplo) => (
              <li key={ejemplo}>
                <button
                  type="button"
                  onClick={() => onEnviar(ejemplo)}
                  className="rounded-full border border-borde bg-superficie px-4 py-2 text-sm text-texto transition-colors hover:border-acento hover:bg-superficie-alta"
                >
                  {ejemplo}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div role="log" aria-live="polite" aria-label="Conversación" className="space-y-4">
        {mensajes.map((m) => (
          <MessageBubble key={m.id} mensaje={m} onReintentar={onReintentar} />
        ))}
      </div>

      {enviando && (
        <div className="mt-4">
          <ThinkingIndicator />
        </div>
      )}

      <div ref={finalRef} />
    </div>
  )
}
