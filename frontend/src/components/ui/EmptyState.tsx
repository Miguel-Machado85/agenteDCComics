import type { ReactNode } from 'react'

interface Props {
  titulo: string
  descripcion?: string
  /** Accion opcional (boton o enlace). */
  children?: ReactNode
}

export default function EmptyState({ titulo, descripcion, children }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-borde px-6 py-10 text-center">
      <p className="font-semibold text-texto">{titulo}</p>
      {descripcion && <p className="mt-1 text-sm text-texto-suave">{descripcion}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
