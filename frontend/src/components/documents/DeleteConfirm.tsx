import { useRef } from 'react'
import type { DocumentoItem } from '../../api/types'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface Props {
  documento: DocumentoItem
  eliminando: boolean
  error: string | null
  onConfirmar: () => void
  onCancelar: () => void
}

/** Dialogo modal: foco atrapado, Esc o clic en el fondo cierran. */
export default function DeleteConfirm({ documento, eliminando, error, onConfirmar, onCancelar }: Props) {
  const dialogoRef = useRef<HTMLDivElement>(null)
  const cancelarRef = useRef<HTMLButtonElement>(null)
  const cerrar = () => {
    if (!eliminando) onCancelar()
  }
  useFocusTrap(dialogoRef, cerrar, cancelarRef)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar()
      }}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="borrar-titulo"
        aria-describedby="borrar-descripcion"
        className="w-full max-w-md rounded-lg border border-borde bg-superficie p-5 shadow-xl"
      >
        <h2 id="borrar-titulo" className="text-3xl">
          ¿Eliminar este documento?
        </h2>
        <p id="borrar-descripcion" className="mt-2 text-sm text-texto-suave">
          Se borrará <strong className="break-words text-texto">«{documento.titulo}»</strong> junto
          con {documento.chunks === 1 ? 'su fragmento' : `sus ${documento.chunks} fragmentos`}, y el
          agente dejará de usarlo para responder. Esta acción no se puede deshacer.
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-md border border-peligro/60 bg-peligro/10 px-3 py-2 text-sm text-peligro">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelarRef}
            type="button"
            onClick={cerrar}
            disabled={eliminando}
            className="rounded-md border border-borde px-3 py-1.5 text-sm font-medium hover:bg-superficie-alta disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={eliminando}
            className="rounded-md bg-peligro px-3 py-1.5 text-sm font-semibold text-white hover:bg-peligro/85 disabled:opacity-50"
          >
            {eliminando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
