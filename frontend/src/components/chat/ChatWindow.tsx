import { useEffect, useRef } from 'react'
import type { Mensaje } from '../../hooks/useChat'
import { SuperBotCara } from '../superbot/SuperBot'
import ErrorBanner from '../ui/ErrorBanner'
import { Skeleton } from '../ui/Skeleton'
import { EJEMPLOS } from './ejemplos'
import MessageBubble from './MessageBubble'
import ThinkingIndicator from './ThinkingIndicator'

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
    <div className="min-h-24 flex-1 overflow-y-auto rounded-lg border border-borde bg-superficie p-3 sm:p-5">
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
          <SuperBotCara className="h-16 w-auto" />
          <p className="max-w-md text-texto-suave">
            Soy SuperBot. Pregúntame lo que quieras sobre héroes, villanos y eventos del
            multiverso DC.
          </p>
          <ul className="flex flex-wrap justify-center gap-2">
            {EJEMPLOS.map((ejemplo) => (
              <li key={ejemplo}>
                <button
                  type="button"
                  onClick={() => onEnviar(ejemplo)}
                  className="rounded-full border border-tinta/80 bg-superficie px-4 py-1.5 text-sm font-semibold text-texto transition-colors hover:border-acento hover:bg-acento hover:text-white"
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
