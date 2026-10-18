import { forwardRef, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

/** Igual que el limite de PreguntaIn en el backend. */
export const MAX_CARACTERES = 2000
const AVISO_CARACTERES = 1800
const ALTURA_MAXIMA_PX = 192

interface Props {
  deshabilitado: boolean
  onEnviar: (pregunta: string) => void
}

const MessageInput = forwardRef<HTMLTextAreaElement, Props>(function MessageInput(
  { deshabilitado, onEnviar },
  ref,
) {
  const [texto, setTexto] = useState('')
  const internoRef = useRef<HTMLTextAreaElement | null>(null)
  const vacio = texto.trim() === ''

  // Crece con el contenido hasta un tope; despues hace scroll
  useLayoutEffect(() => {
    const el = internoRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, ALTURA_MAXIMA_PX)}px`
  }, [texto])

  const enviar = () => {
    if (deshabilitado || vacio) return
    onEnviar(texto)
    setTexto('')
  }

  const alEnviar = (e: FormEvent) => {
    e.preventDefault()
    enviar()
  }

  const alPresionar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia; Shift+Enter (o Enter al componer con IME) hace salto de linea
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      enviar()
    }
  }

  const asignarRef = (el: HTMLTextAreaElement | null) => {
    internoRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }

  return (
    <form
      onSubmit={alEnviar}
      className="rounded-lg border-2 border-tinta bg-superficie p-3 focus-within:border-acento"
    >
      <label htmlFor="pregunta" className="sr-only">
        Escribe tu pregunta
      </label>
      <textarea
        id="pregunta"
        ref={asignarRef}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={alPresionar}
        disabled={deshabilitado}
        maxLength={MAX_CARACTERES}
        rows={1}
        placeholder={deshabilitado ? 'Esperando la respuesta…' : 'Pregúntale a SuperBot sobre héroes, villanos o eventos…'}
        aria-describedby="contador-caracteres"
        className="block w-full resize-none bg-transparent text-texto placeholder:text-texto-suave focus:outline-none disabled:opacity-60"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          id="contador-caracteres"
          className={`text-xs ${texto.length >= AVISO_CARACTERES ? 'text-peligro' : 'text-texto-suave'}`}
        >
          {texto.length} / {MAX_CARACTERES}
        </span>
        <button
          type="submit"
          disabled={deshabilitado || vacio}
          className="boton boton-primario"
        >
          Enviar
        </button>
      </div>
    </form>
  )
})

export default MessageInput
