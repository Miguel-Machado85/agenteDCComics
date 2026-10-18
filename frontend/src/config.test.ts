import { afterEach, describe, expect, it, vi } from 'vitest'

// config.ts valida las variables al importarse: se fijan antes del import dinamico
async function cargarConfig(timeout?: string) {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'http://localhost:8000/')
  vi.stubEnv('VITE_KEYCLOAK_URL', 'http://localhost:8080')
  vi.stubEnv('VITE_KEYCLOAK_REALM', 'dc-comics')
  vi.stubEnv('VITE_KEYCLOAK_CLIENT_ID', 'dc-frontend')
  vi.stubEnv('VITE_CHAT_TIMEOUT_S', timeout ?? '')
  return import('./config')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('config', () => {
  it('sin VITE_CHAT_TIMEOUT_S espera 600 s', async () => {
    const { config } = await cargarConfig()
    expect(config.chatTimeoutS).toBe(600)
    expect(config.apiUrl).toBe('http://localhost:8000')
  })

  it('usa VITE_CHAT_TIMEOUT_S si viene', async () => {
    const { config } = await cargarConfig(' 900 ')
    expect(config.chatTimeoutS).toBe(900)
  })

  it.each(['abc', '0', '-5', '1.5'])('rechaza VITE_CHAT_TIMEOUT_S=%s', async (valor) => {
    await expect(cargarConfig(valor)).rejects.toThrow(/VITE_CHAT_TIMEOUT_S/)
  })
})
