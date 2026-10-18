import { useEffect, useRef } from 'react'
import ChatWindow from '../components/chat/ChatWindow'
import MessageInput from '../components/chat/MessageInput'
import { useChat } from '../hooks/useChat'
import { useTituloPagina } from '../hooks/useTituloPagina'

export default function ChatPage() {
  useTituloPagina('Chat')
  const chat = useChat()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Al montar y cada vez que llega la respuesta (el textarea ya no esta deshabilitado)
  useEffect(() => {
    if (!chat.enviando) inputRef.current?.focus()
  }, [chat.enviando])

  // Layout le da a /chat la altura de la ventana: solo la conversacion hace
  // scroll y el input queda siempre visible abajo
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <h1 className="sr-only sm:not-sr-only sm:text-2xl sm:font-semibold">Chat</h1>
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
