// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Fuente } from '../../api/types'
import type { Mensaje } from '../../hooks/useChat'
import MessageBubble from './MessageBubble'

const FUENTES: Fuente[] = [
  {
    document_id: 1,
    titulo: 'Batman',
    url: 'https://dc.fandom.com/wiki/Batman',
    seccion: 'Historia',
    similitud: 0.88,
    fragmento: 'Bruce Wayne es Batman.',
  },
  {
    document_id: 2,
    titulo: 'Bob Kane',
    url: null,
    seccion: null,
    similitud: 0.65,
    fragmento: 'Bob Kane creó a Batman junto con Bill Finger.',
  },
]

function agente(extra: Partial<Extract<Mensaje, { tipo: 'agente' }>> = {}): Mensaje {
  return {
    id: 'a-1',
    tipo: 'agente',
    respuesta: 'Batman fue creado por Bob Kane y Bill Finger.',
    rechazada: false,
    intencion: 'pregunta',
    fuentes: FUENTES,
    ...extra,
  }
}

function renderizar(mensaje: Mensaje, onReintentar = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/chat']}>
      <Routes>
        <Route path="/chat" element={<MessageBubble mensaje={mensaje} onReintentar={onReintentar} />} />
        <Route path="/documentos" element={<p>Página de documentos</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return { onReintentar }
}

afterEach(cleanup)

describe('MessageBubble', () => {
  it('usuario: muestra el texto sin botones', () => {
    renderizar({ id: 'u-1', tipo: 'usuario', texto: '¿Quién es Aquaman?' })

    expect(screen.getByText('¿Quién es Aquaman?')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('agente normal: muestra la respuesta y un panel de fuentes colapsable', async () => {
    renderizar(agente())

    expect(screen.getByText('Batman fue creado por Bob Kane y Bill Finger.')).toBeInTheDocument()
    const boton = screen.getByRole('button', { name: /2 fuentes/ })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Bob Kane')).not.toBeInTheDocument()

    await userEvent.click(boton)

    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Bob Kane')).toBeInTheDocument()
    expect(screen.getByText('Historia')).toBeInTheDocument()
    expect(screen.getByText('88 % · fuerte')).toBeInTheDocument()
    const enlace = screen.getByRole('link', { name: /Abrir fuente/ })
    expect(enlace).toHaveAttribute('target', '_blank')
    expect(enlace).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('rechazada: estilo de advertencia, texto del backend y enlace a /documentos', async () => {
    const texto = 'No encontré información suficiente en mis fuentes para responder.'
    renderizar(agente({ respuesta: texto, rechazada: true, fuentes: [] }))

    expect(screen.getByText(texto)).toBeInTheDocument()
    expect(screen.getByText('Fuera de mis fuentes')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Subir un documento' }))

    expect(screen.getByText('Página de documentos')).toBeInTheDocument()
  })

  it.each(['saludo', 'ambigua'])('%s: estilo neutro y sin fuentes', (intencion) => {
    renderizar(agente({ respuesta: '¡Hola! Pregúntame sobre DC.', intencion }))

    expect(screen.getByText('¡Hola! Pregúntame sobre DC.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /fuentes?/ })).not.toBeInTheDocument()
  })

  it('error del sistema: mensaje en una alerta y botón Reintentar', async () => {
    const { onReintentar } = renderizar({
      id: 'e-1',
      tipo: 'error',
      texto: 'El servicio no está disponible en este momento. Intenta más tarde.',
      pregunta: 'Who created Batman?',
    })

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent('Error del sistema')
    expect(alerta).toHaveTextContent('El servicio no está disponible en este momento.')
    expect(screen.queryByRole('link', { name: 'Subir un documento' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(onReintentar).toHaveBeenCalledWith('e-1')
  })
})
