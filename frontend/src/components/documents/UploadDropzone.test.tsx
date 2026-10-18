// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { subirDocumento } from '../../api/documents'
import type { DocumentoSubido } from '../../api/types'
import { TAMANO_MAXIMO_BYTES } from '../../utils/archivos'
import UploadDropzone from './UploadDropzone'

vi.mock('../../api/documents', () => ({ subirDocumento: vi.fn() }))
// client.ts importa keycloak-js al cargar: no hace falta en estas pruebas
vi.mock('../../auth/keycloak', () => ({ getToken: vi.fn(), login: vi.fn(), refreshToken: vi.fn() }))
vi.mock('../../config', () => ({ config: { apiUrl: 'http://api' } }))

const subirMock = vi.mocked(subirDocumento)

const RESULTADO: DocumentoSubido = {
  id: 7,
  titulo: 'notas',
  chunks: 3,
  mensaje: 'Documento procesado: 3 fragmentos listos para consultar.',
}

function crearArchivo(nombre: string, tamano = 100): File {
  const archivo = new File(['x'], nombre)
  Object.defineProperty(archivo, 'size', { value: tamano })
  return archivo
}

function renderizar(onSubido = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/documentos']}>
      <Routes>
        <Route path="/documentos" element={<UploadDropzone onSubido={onSubido} />} />
        <Route path="/chat" element={<p>Página del chat</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return { onSubido, input: screen.getByLabelText('Elegir archivo', { selector: 'input' }) }
}

/** userEvent.upload respeta accept; fireEvent no, como al soltar un archivo. */
function elegir(input: HTMLElement, ...archivos: File[]) {
  fireEvent.change(input, { target: { files: archivos } })
}

afterEach(() => {
  cleanup()
  subirMock.mockReset()
})

describe('UploadDropzone', () => {
  it('el input solo acepta los formatos soportados', () => {
    const { input } = renderizar()
    expect(input).toHaveAttribute('accept', '.pdf,.txt,.md,.csv,.docx')
  })

  it.each(['programa.exe', 'foto.png'])('rechaza %s en el cliente sin llamar al backend', (nombre) => {
    const { input } = renderizar()
    elegir(input, crearArchivo(nombre))

    expect(screen.getByRole('alert')).toHaveTextContent('no es un formato soportado')
    expect(subirMock).not.toHaveBeenCalled()
  })

  it('rechaza un archivo de más de 10 MB sin llamar al backend', () => {
    const { input } = renderizar()
    elegir(input, crearArchivo('grande.pdf', TAMANO_MAXIMO_BYTES + 1))

    expect(screen.getByRole('alert')).toHaveTextContent('el máximo es 10 MB')
    expect(subirMock).not.toHaveBeenCalled()
  })

  it('al soltar varios archivos pide uno a la vez', () => {
    renderizar()
    fireEvent.drop(screen.getByTestId('dropzone'), {
      dataTransfer: { files: [crearArchivo('a.txt'), crearArchivo('b.txt')] },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Sube un archivo a la vez.')
    expect(subirMock).not.toHaveBeenCalled()
  })

  it('sube un .txt: muestra el progreso, luego el éxito y enlaza al chat', async () => {
    let resolver!: (r: DocumentoSubido) => void
    subirMock.mockReturnValue(new Promise((r) => (resolver = r)))
    const { input, onSubido } = renderizar()

    elegir(input, crearArchivo('notas.txt', 2048))

    expect(screen.getByText(/Procesando: extrayendo texto y generando embeddings/)).toBeInTheDocument()
    expect(screen.getByText('notas.txt')).toBeInTheDocument()
    expect(screen.getByTestId('dropzone')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('button', { name: 'Elegir archivo' })).not.toBeInTheDocument()

    resolver(RESULTADO)

    const mensaje = await screen.findByText(RESULTADO.mensaje)
    expect(mensaje.closest('[role="status"]')).toHaveTextContent('«notas» · 3 fragmentos')
    expect(onSubido).toHaveBeenCalledWith(RESULTADO)

    await userEvent.click(screen.getByRole('link', { name: /Preguntar sobre este documento/ }))
    expect(screen.getByText('Página del chat')).toBeInTheDocument()
  })

  it.each([
    [413, 'demasiado grande'],
    [415, 'Formato no soportado'],
    [422, 'No se pudo extraer texto'],
    [503, 'Servicio caído'],
  ])('error %i del backend: muestra su mensaje', async (status, texto) => {
    subirMock.mockRejectedValue(new ApiError(status, 'Servicio caído'))
    const { input, onSubido } = renderizar()

    elegir(input, crearArchivo('escaneado.pdf'))

    expect(await screen.findByRole('alert')).toHaveTextContent(texto)
    expect(onSubido).not.toHaveBeenCalled()
  })
})
