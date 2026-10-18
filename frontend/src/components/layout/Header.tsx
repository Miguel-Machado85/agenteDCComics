import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import NavBar from './NavBar'

export default function Header() {
  const { usuario, logout } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Cierra el menu movil al tocar fuera o con Escape
  useEffect(() => {
    if (!menuAbierto) return
    const alClic = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAbierto(false)
    }
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false)
    }
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTecla)
    }
  }, [menuAbierto])

  const botonSalir =
    'rounded-md border border-borde px-3 py-1.5 text-sm font-medium text-texto-suave transition-colors hover:border-peligro/60 hover:text-peligro'

  return (
    <header className="border-b border-borde bg-superficie/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/chat" className="text-lg font-semibold text-texto no-underline">
          Agente <span className="text-acento-fuerte">DC Comics</span>
        </Link>

        {/* En movil la navegacion baja a su propia fila */}
        <div className="order-last w-full sm:order-none sm:w-auto">
          <NavBar />
        </div>

        {/* Escritorio: usuario y boton visibles */}
        <div className="hidden items-center gap-3 sm:flex">
          <span className="max-w-40 truncate text-sm text-texto-suave" title={usuario.username}>
            {usuario.username}
          </span>
          <button type="button" onClick={() => void logout()} className={botonSalir}>
            Cerrar sesión
          </button>
        </div>

        {/* Movil: menu compacto */}
        <div ref={menuRef} className="relative sm:hidden">
          <button
            type="button"
            aria-label="Menú de usuario"
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-borde bg-superficie-alta text-sm font-semibold uppercase text-acento-fuerte"
          >
            {usuario.username.charAt(0) || '?'}
          </button>
          {menuAbierto && (
            <div
              role="menu"
              className="absolute right-0 z-10 mt-2 w-48 rounded-md border border-borde bg-superficie p-2 shadow-lg"
            >
              <p className="truncate px-2 py-1 text-sm text-texto" title={usuario.username}>
                {usuario.username}
              </p>
              <button
                type="button"
                role="menuitem"
                onClick={() => void logout()}
                className={`${botonSalir} mt-1 w-full text-left`}
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
