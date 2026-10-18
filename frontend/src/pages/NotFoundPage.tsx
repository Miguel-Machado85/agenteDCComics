import { Link } from 'react-router-dom'
import { useTituloPagina } from '../hooks/useTituloPagina'

export default function NotFoundPage() {
  useTituloPagina('Página no encontrada')
  return (
    <section className="space-y-3">
      <h1 className="text-5xl">Página no encontrada</h1>
      <p className="text-texto-suave">La dirección que abriste no existe.</p>
      <Link to="/chat">Volver al chat</Link>
    </section>
  )
}
