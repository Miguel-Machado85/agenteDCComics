import { Outlet, useMatch } from 'react-router-dom'
import Header from './Header'

export default function Layout() {
  // En /chat la pagina ocupa justo la ventana para que el input no salga de la vista
  const enChat = useMatch('/chat') !== null

  return (
    <div className={`flex flex-col ${enChat ? 'h-dvh' : 'min-h-dvh'}`}>
      <Header />
      <main
        className={`mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 ${
          enChat ? 'min-h-0 py-3 sm:py-6' : 'py-6 sm:py-8'
        }`}
      >
        <Outlet />
      </main>
    </div>
  )
}
