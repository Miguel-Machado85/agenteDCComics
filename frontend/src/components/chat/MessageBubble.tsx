import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Mensaje } from '../../hooks/useChat'
import { SuperBotCara } from '../superbot/SuperBot'
import SourcesPanel from './SourcesPanel'

interface Props {
  mensaje: Mensaje
  onReintentar: (idError: string) => void
}

// Esquina recortada hacia quien habla, como un globo de comic
const BASE = 'min-w-0 rounded-xl px-3 py-2.5 break-words sm:px-4 sm:py-3'
const BOTON =
  'mt-3 inline-block rounded-full border px-3 py-1 text-sm font-semibold transition-colors'

/** Respuesta de SuperBot: su cara a la izquierda y el globo con la esquina hacia ella. */
function DeSuperBot({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div className="flex items-start justify-start gap-2">
      <SuperBotCara className="mt-1 h-7 w-auto shrink-0" />
      <div className={`${BASE} max-w-[85%] rounded-tl-none ${className}`}>{children}</div>
    </div>
  )
}

export default function MessageBubble({ mensaje, onReintentar }: Props) {
  if (mensaje.tipo === 'usuario') {
    return (
      <div className="flex justify-end">
        <div className={`${BASE} max-w-[85%] rounded-br-none bg-acento whitespace-pre-wrap text-white`}>
          <span className="sr-only">Tú: </span>
          {mensaje.texto}
        </div>
      </div>
    )
  }

  if (mensaje.tipo === 'error') {
    return (
      <div className="flex justify-start">
        <div role="alert" className={`${BASE} max-w-[85%] border border-peligro/60 bg-peligro/5`}>
          <p className="text-sm font-semibold text-peligro">
            <span aria-hidden="true">✕ </span>Error del sistema
          </p>
          <p className="mt-1">{mensaje.texto}</p>
          <button
            type="button"
            onClick={() => onReintentar(mensaje.id)}
            className={`${BOTON} border-peligro/60 text-peligro hover:bg-peligro/10`}
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (mensaje.rechazada) {
    return (
      <DeSuperBot className="border border-aviso/50 bg-aviso/5">
        <p className="text-sm font-semibold text-aviso">
          <span aria-hidden="true">⚠ </span>Fuera de mis fuentes
        </p>
        <p className="mt-1 whitespace-pre-wrap">{mensaje.respuesta}</p>
        <Link
          to="/documentos"
          className={`${BOTON} border-aviso/60 text-aviso no-underline hover:bg-aviso/10`}
        >
          Subir un documento
        </Link>
      </DeSuperBot>
    )
  }

  if (mensaje.intencion === 'saludo' || mensaje.intencion === 'ambigua') {
    return (
      <DeSuperBot className="bg-superficie-alta whitespace-pre-wrap">
        <span className="sr-only">SuperBot: </span>
        {mensaje.respuesta}
      </DeSuperBot>
    )
  }

  return (
    <DeSuperBot className="bg-fondo">
      <p className="whitespace-pre-wrap">
        <span className="sr-only">SuperBot: </span>
        {mensaje.respuesta}
      </p>
      <SourcesPanel fuentes={mensaje.fuentes} />
    </DeSuperBot>
  )
}
