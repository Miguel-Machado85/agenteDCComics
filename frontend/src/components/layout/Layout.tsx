import { Outlet, useMatch } from 'react-router-dom'
import Header from './Header'

export default function Layout() {
  // En /chat la pagina ocupa justo la ventana para que el input no salga de la vista
  const enChat = useMatch('/chat') !== null
  // La portada de SuperBot va a todo el ancho y maneja sus propios margenes
  const enInicio = useMatch('/') !== null

  let clasesMain = 'mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:py-10'
  if (enChat) clasesMain = 'mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 py-3 sm:py-6'
  if (enInicio) clasesMain = 'flex w-full flex-1 flex-col'

  return (
    <div className={`flex flex-col ${enChat ? 'h-dvh' : 'min-h-dvh'}`}>
      <Header />
      <main className={clasesMain}>
        <Outlet />
      </main>
    </div>
  )
}
