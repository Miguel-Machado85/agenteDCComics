// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DocumentoItem } from '../../api/types'
import DeleteConfirm from './DeleteConfirm'

const DOC: DocumentoItem = {
  id: 1,
  titulo: 'Mis notas',
  source: 'upload',
  url: null,
  uploaded_by: 'yo',
  chunks: 4,
  creado: '2026-10-18T15:30:00Z',
}

function renderizar(extra: Partial<Parameters<typeof DeleteConfirm>[0]> = {}) {
  const props = { documento: DOC, eliminando: false, error: null, onConfirmar: vi.fn(), onCancelar: vi.fn(), ...extra }
  render(<DeleteConfirm {...props} />)
  return props
}

afterEach(cleanup)

describe('DeleteConfirm', () => {
  it('es un diálogo modal que explica qué se borra', () => {
    renderizar()
    const dialogo = screen.getByRole('dialog', { name: '¿Eliminar este documento?' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(dialogo).toHaveAccessibleDescription(/4 fragmentos.*dejará de usarlo/)
  })

  it('enfoca Cancelar, atrapa el foco con Tab y cierra con Esc', async () => {
    const { onCancelar } = renderizar()
    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    const eliminar = screen.getByRole('button', { name: 'Eliminar' })

    expect(cancelar).toHaveFocus()
    await userEvent.tab()
    expect(eliminar).toHaveFocus()
    await userEvent.tab()
    expect(cancelar).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(eliminar).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(onCancelar).toHaveBeenCalledOnce()
  })

  it('mientras elimina no se puede cerrar y muestra el error recibido', async () => {
    const { onCancelar } = renderizar({ eliminando: true, error: 'Solo puedes borrar documentos que subiste tú.' })

    expect(screen.getByRole('button', { name: 'Eliminando…' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Solo puedes borrar')
    await userEvent.keyboard('{Escape}')
    expect(onCancelar).not.toHaveBeenCalled()
  })
})
