import { Link } from 'react-router-dom'
import type { Mensaje } from '../../hooks/useChat'
import SourcesPanel from './SourcesPanel'

interface Props {
  mensaje: Mensaje
  onReintentar: (idError: string) => void
}

const BASE = 'max-w-[85%] min-w-0 rounded-lg border px-3 py-2.5 break-words sm:px-4 sm:py-3'
const BOTON =
  'mt-3 inline-block rounded-md border px-3 py-1.5 text-sm font-medium transition-colors'

export default function MessageBubble({ mensaje, onReintentar }: Props) {
  if (mensaje.tipo === 'usuario') {
    return (
      <div className="flex justify-end">
        <div className={`${BASE} border-acento/50 bg-acento/20 whitespace-pre-wrap`}>
          <span className="sr-only">Tú: </span>
          {mensaje.texto}
        </div>
      </div>
    )
  }

  if (mensaje.tipo === 'error') {
    return (
      <div className="flex justify-start">
        <div role="alert" className={`${BASE} border-peligro/60 bg-peligro/10`}>
          <p className="text-sm font-semibold text-peligro">
            <span aria-hidden="true">✕ </span>Error del sistema
          </p>
          <p className="mt-1">{mensaje.texto}</p>
          <button
            type="button"
            onClick={() => onReintentar(mensaje.id)}
            className={`${BOTON} border-peligro/60 text-peligro hover:bg-peligro/20`}
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (mensaje.rechazada) {
    return (
      <div className="flex justify-start">
        <div className={`${BASE} border-aviso/60 bg-aviso/10`}>
          <p className="text-sm font-semibold text-aviso">
            <span aria-hidden="true">⚠ </span>Fuera de mis fuentes
          </p>
          <p className="mt-1 whitespace-pre-wrap">{mensaje.respuesta}</p>
          <Link
            to="/documentos"
            className={`${BOTON} border-aviso/60 text-aviso no-underline hover:bg-aviso/20`}
          >
            Subir un documento
          </Link>
        </div>
      </div>
    )
  }

  if (mensaje.intencion === 'saludo' || mensaje.intencion === 'ambigua') {
    return (
      <div className="flex justify-start">
        <div className={`${BASE} border-borde bg-superficie-alta whitespace-pre-wrap`}>
          <span className="sr-only">Agente: </span>
          {mensaje.respuesta}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className={`${BASE} border-borde bg-superficie`}>
        <p className="whitespace-pre-wrap">
          <span className="sr-only">Agente: </span>
          {mensaje.respuesta}
        </p>
        <SourcesPanel fuentes={mensaje.fuentes} />
      </div>
    </div>
  )
}
