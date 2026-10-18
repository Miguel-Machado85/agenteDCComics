// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ThinkingIndicator from './ThinkingIndicator'

const AVISO = 'En el servidor puede tardar varios minutos; no cierres ni recargues la página'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ThinkingIndicator', () => {
  it('a los 20 s avisa que puede tardar varios minutos', () => {
    vi.useFakeTimers()
    render(<ThinkingIndicator />)

    act(() => vi.advanceTimersByTime(19_000))
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText(AVISO)).toBeInTheDocument()
  })
})
