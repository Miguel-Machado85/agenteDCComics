import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { SuperBotCara } from '../superbot/SuperBot'
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
    'rounded-full border border-white/30 px-3 py-1 text-sm font-semibold text-white/80 transition-colors hover:border-white hover:text-white'

  return (
    <header className="bg-tinta text-white [&_:focus-visible]:outline-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-2.5 sm:py-0">
        <Link to="/" className="flex items-center gap-2 py-1 text-white no-underline sm:py-2.5">
          <SuperBotCara className="h-8 w-auto" />
          <span className="font-titulo text-[1.7rem] leading-none font-extrabold tracking-wide uppercase">
            SuperBot
          </span>
        </Link>

        {/* En movil la navegacion baja a su propia fila */}
        <div className="order-last w-full sm:order-none sm:mr-auto sm:w-auto sm:self-end">
          <NavBar />
        </div>

        {/* Escritorio: usuario y boton visibles */}
        <div className="hidden items-center gap-3 sm:flex">
          <span className="max-w-40 truncate text-sm text-white/65" title={usuario.username}>
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
            className="flex h-9 w-9 items-center justify-center rounded-full bg-acento text-sm font-bold text-white uppercase"
          >
            {usuario.username.charAt(0) || '?'}
          </button>
          {menuAbierto && (
            <div
              role="menu"
              className="absolute right-0 z-10 mt-2 w-48 rounded-md border border-white/20 bg-tinta p-2 shadow-lg"
            >
              <p className="truncate px-2 py-1 text-sm text-white" title={usuario.username}>
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
