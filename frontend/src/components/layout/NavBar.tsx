import { NavLink } from 'react-router-dom'

const enlaces = [
  { to: '/', texto: 'Inicio' },
  { to: '/chat', texto: 'Chat' },
  { to: '/documentos', texto: 'Documentos' },
  { to: '/historial', texto: 'Historial' },
]

/** NavLink pone aria-current="page" en el enlace activo. */
export default function NavBar() {
  return (
    <nav aria-label="Principal">
      {/* En movil los enlaces se reparten el ancho para que sean faciles de tocar */}
      <ul className="flex gap-1 sm:gap-2">
        {enlaces.map(({ to, texto }) => (
          <li key={to} className="flex-1 sm:flex-none">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'block border-b-[3px] px-2 pt-2 pb-1.5 text-center font-titulo text-lg font-extrabold tracking-wide uppercase no-underline transition-colors sm:px-3',
                  isActive
                    ? 'border-acento text-white'
                    : 'border-transparent text-white/65 hover:border-white/40 hover:text-white',
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
