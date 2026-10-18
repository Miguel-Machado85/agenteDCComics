// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DocumentoItem } from '../../api/types'
import DocumentTable from './DocumentTable'

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ usuario: { sub: 'yo', username: 'demo' } }),
}))

const base = { url: null, chunks: 4, creado: '2026-10-18T15:30:00Z' }
const ITEMS: DocumentoItem[] = [
  { ...base, id: 1, titulo: 'Mis notas', source: 'upload', uploaded_by: 'yo' },
  { ...base, id: 2, titulo: 'Notas ajenas', source: 'upload', uploaded_by: 'otro' },
  { ...base, id: 3, titulo: 'Batman', source: 'dc_wiki', uploaded_by: null, url: 'https://dc.fandom.com/wiki/Batman' },
]

afterEach(cleanup)

/** La tabla (escritorio) es la primera vista; las tarjetas repiten el contenido. */
const tabla = () => within(screen.getByRole('table'))

describe('DocumentTable', () => {
  it('solo ofrece Eliminar y "Tuyo" en los uploads del usuario', () => {
    render(<DocumentTable items={ITEMS} onEliminar={vi.fn()} />)

    expect(tabla().getByRole('button', { name: 'Eliminar Mis notas' })).toBeInTheDocument()
    expect(tabla().queryByRole('button', { name: 'Eliminar Notas ajenas' })).not.toBeInTheDocument()
    expect(tabla().queryByRole('button', { name: 'Eliminar Batman' })).not.toBeInTheDocument()

    const filaMia = tabla().getByText('Mis notas').closest('tr')!
    expect(within(filaMia).getByText('Tuyo')).toBeInTheDocument()
    expect(tabla().getAllByText('Tuyo')).toHaveLength(1)
  })

  it('el título es un enlace externo solo si hay url', () => {
    render(<DocumentTable items={ITEMS} onEliminar={vi.fn()} />)

    const enlace = tabla().getByRole('link', { name: 'Batman' })
    expect(enlace).toHaveAttribute('href', 'https://dc.fandom.com/wiki/Batman')
    expect(enlace).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(tabla().queryByRole('link', { name: 'Mis notas' })).not.toBeInTheDocument()
  })

  it('Eliminar entrega el documento', async () => {
    const onEliminar = vi.fn()
    render(<DocumentTable items={ITEMS} onEliminar={onEliminar} />)

    await userEvent.click(tabla().getByRole('button', { name: 'Eliminar Mis notas' }))

    expect(onEliminar).toHaveBeenCalledWith(ITEMS[0])
  })
})
