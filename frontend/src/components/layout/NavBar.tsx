import { NavLink } from 'react-router-dom'

const enlaces = [
  { to: '/chat', texto: 'Chat' },
  { to: '/documentos', texto: 'Documentos' },
  { to: '/historial', texto: 'Historial' },
]

/** NavLink pone aria-current="page" en el enlace activo. */
export default function NavBar() {
  return (
    <nav aria-label="Principal">
      {/* En movil los enlaces se reparten el ancho para que sean faciles de tocar */}
      <ul className="flex gap-1">
        {enlaces.map(({ to, texto }) => (
          <li key={to} className="flex-1 sm:flex-none">
            <NavLink
              to={to}
              className={({ isActive }) =>
                [
                  'block rounded-md px-3 py-2 text-center text-sm font-medium no-underline transition-colors sm:py-1.5',
                  isActive
                    ? 'bg-acento/15 text-acento-fuerte ring-1 ring-acento/40'
                    : 'text-texto-suave hover:bg-superficie-alta hover:text-texto',
                ].join(' ')
              }
            >
              {texto}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
