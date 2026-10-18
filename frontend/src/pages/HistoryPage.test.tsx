// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { obtenerHistorial } from '../api/chat'
import { ApiError } from '../api/client'
import type { EntradaHistorial } from '../api/types'
import { LIMITE_HISTORIAL } from '../hooks/useHistory'
import HistoryPage from './HistoryPage'

vi.mock('../api/chat', () => ({ obtenerHistorial: vi.fn() }))
// client.ts importa keycloak-js al cargar: no hace falta en estas pruebas
vi.mock('../auth/keycloak', () => ({ getToken: vi.fn(), login: vi.fn(), refreshToken: vi.fn() }))
vi.mock('../config', () => ({ config: { apiUrl: 'http://api' } }))

const historialMock = vi.mocked(obtenerHistorial)

function entrada(id: number, extra: Partial<EntradaHistorial> = {}): EntradaHistorial {
  return {
    id,
    pregunta: `Pregunta ${id}`,
    respuesta: `Respuesta ${id}`,
    rechazada: false,
    fuentes: [],
    creado: '2026-10-18T15:30:00Z',
    ...extra,
  }
}

function renderizar() {
  render(
    <MemoryRouter initialEntries={['/historial']}>
      <Routes>
        <Route path="/historial" element={<HistoryPage />} />
        <Route path="/chat" element={<p>Página del chat</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  historialMock.mockReset()
})

describe('HistoryPage', () => {
  it('muestra pregunta, respuesta, fuentes y la etiqueta Rechazada', async () => {
    historialMock.mockResolvedValueOnce([
      entrada(2, {
        fuentes: [
          { document_id: 9, titulo: 'Batman', url: null, seccion: null, similitud: 0.9, fragmento: 'x' },
        ],
      }),
      entrada(1, { rechazada: true }),
    ])
    renderizar()

    expect(await screen.findByText('Pregunta 2')).toBeInTheDocument()
    expect(screen.getByText('Respuesta 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /1 fuente/ })).toBeInTheDocument()
    expect(screen.getAllByText('Rechazada')).toHaveLength(1)
    expect(historialMock).toHaveBeenCalledWith({ limit: 20, offset: 0 }, expect.any(AbortSignal))
    expect(document.title).toBe('Historial · SuperBot · DC Comics')
    // Menos de 20: es la unica pagina
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument()
  })

  it('estado vacío con un botón que lleva al chat', async () => {
    historialMock.mockResolvedValueOnce([])
    renderizar()

    await userEvent.click(await screen.findByRole('link', { name: 'Ir al chat' }))

    expect(screen.getByText('Página del chat')).toBeInTheDocument()
  })

  it('error al cargar: banner con Reintentar que vuelve a pedir la página', async () => {
    historialMock
      .mockRejectedValueOnce(new ApiError(503, 'La base de datos no responde.'))
      .mockResolvedValueOnce([entrada(1)])
    renderizar()

    expect(await screen.findByRole('alert')).toHaveTextContent('La base de datos no responde.')
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Pregunta 1')).toBeInTheDocument()
    expect(historialMock).toHaveBeenCalledTimes(2)
  })

  it('pagina con offset y retrocede si la página siguiente viene vacía', async () => {
    const llena = Array.from({ length: LIMITE_HISTORIAL }, (_, i) => entrada(100 - i))
    historialMock.mockImplementation(async ({ offset = 0 } = {}) => (offset === 0 ? llena : []))
    renderizar()

    await screen.findByText('Pregunta 100')
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }))

    // La pagina 2 vino vacia: vuelve a la 1, que resulta ser la unica
    expect(historialMock).toHaveBeenCalledWith({ limit: 20, offset: 20 }, expect.any(AbortSignal))
    await waitFor(() =>
      expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Pregunta 100')).toBeInTheDocument()
  })
})
