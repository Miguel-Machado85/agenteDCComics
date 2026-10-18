import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ChatWindow from '../components/chat/ChatWindow'
import MessageInput from '../components/chat/MessageInput'
import { useChat } from '../hooks/useChat'
import { useTituloPagina } from '../hooks/useTituloPagina'

/** La portada puede abrir el chat con una pregunta ya elegida. */
export interface EstadoChat {
  pregunta?: string
}

export default function ChatPage() {
  useTituloPagina('Chat')
  const chat = useChat()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const preguntaInicial = (location.state as EstadoChat | null)?.pregunta
  const { enviar } = chat

  // Al montar y cada vez que llega la respuesta (el textarea ya no esta deshabilitado)
  useEffect(() => {
    if (!chat.enviando) inputRef.current?.focus()
  }, [chat.enviando])

  // Envia la pregunta que llega desde la portada y la borra del historial del navegador
  // para que recargar no la repita. El setTimeout evita el doble envio de StrictMode.
  useEffect(() => {
    if (!preguntaInicial) return
    const timer = setTimeout(() => {
      navigate(location.pathname, { replace: true, state: null })
      void enviar(preguntaInicial)
    }, 0)
    return () => clearTimeout(timer)
  }, [preguntaInicial, enviar, navigate, location.pathname])

  // Layout le da a /chat la altura de la ventana: solo la conversacion hace
  // scroll y el input queda siempre visible abajo
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <h1 className="sr-only sm:not-sr-only sm:text-4xl">Chat con SuperBot</h1>
      <ChatWindow
        mensajes={chat.mensajes}
        enviando={chat.enviando}
        cargandoHistorial={chat.cargandoHistorial}
        errorHistorial={chat.errorHistorial}
        onEnviar={chat.enviar}
        onReintentar={chat.reintentar}
        onRecargarHistorial={chat.recargarHistorial}
      />
      <MessageInput ref={inputRef} deshabilitado={chat.enviando} onEnviar={chat.enviar} />
    </div>
  )
}
