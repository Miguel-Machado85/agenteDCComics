import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { login, refreshToken } from '../auth/keycloak'
import {
  ApiError,
  MENSAJE_SIN_CONEXION,
  MENSAJE_TIMEOUT,
  apiFetch,
  mensajeDeError,
} from './client'

vi.mock('../config', () => ({
  config: { apiUrl: 'http://api.test' },
}))

vi.mock('../auth/keycloak', () => ({
  getToken: vi.fn(async () => 'token-1'),
  refreshToken: vi.fn(async () => true),
  login: vi.fn(async () => {}),
}))

const fetchMock = vi.fn<typeof fetch>()

function json(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function capturar(promesa: Promise<unknown>): Promise<ApiError> {
  try {
    await promesa
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError)
    return e as ApiError
  }
  throw new Error('Se esperaba un ApiError')
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  fetchMock.mockReset()
})

describe('apiFetch: peticion', () => {
  it('antepone apiUrl, agrega el token y serializa objetos planos como JSON', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }))
    await apiFetch('/chat', { method: 'POST', body: { pregunta: 'hola' } })

    const [url, init] = fetchMock.mock.calls[0]
    const headers = new Headers(init?.headers)
    expect(url).toBe('http://api.test/chat')
    expect(headers.get('Authorization')).toBe('Bearer token-1')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(init?.body).toBe('{"pregunta":"hola"}')
  })

  it('no fija Content-Type con FormData', async () => {
    fetchMock.mockResolvedValueOnce(json(201, {}))
    const form = new FormData()
    form.append('archivo', new Blob(['x']), 'a.txt')
    await apiFetch('/documents', { method: 'POST', body: form })

    const init = fetchMock.mock.calls[0][1]
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false)
    expect(init?.body).toBe(form)
  })

  it('devuelve undefined en un 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(apiFetch('/documents/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })
})

describe('apiFetch: normalizacion de errores', () => {
  it('usa detail tal cual si es string', async () => {
    fetchMock.mockResolvedValueOnce(json(503, { detail: 'El modelo no responde.' }))
    const e = await capturar(apiFetch('/chat'))
    expect(e.status).toBe(503)
    expect(e.message).toBe('El modelo no responde.')
  })

  it('une los msg de un arreglo de Pydantic', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        detail: [
          { loc: ['body', 'pregunta'], msg: 'String should have at least 1 character', type: 'x' },
          { loc: ['query', 'limit'], msg: 'Input should be less than or equal to 100', type: 'y' },
        ],
      }),
    )
    const e = await capturar(apiFetch('/chat'))
    expect(e.status).toBe(422)
    expect(e.message).toBe(
      'String should have at least 1 character. Input should be less than or equal to 100',
    )
  })

  it('usa un mensaje generico por codigo si no hay JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad Gateway</html>', { status: 502 }))
    const e = await capturar(apiFetch('/chat'))
    expect(e.status).toBe(502)
    expect(e.message).toBe('El servidor no está disponible en este momento.')
  })

  it('usa un mensaje generico para codigos desconocidos', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 418 }))
    const e = await capturar(apiFetch('/chat'))
    expect(e.message).toBe('Error inesperado del servidor (418).')
  })

  it('mapea el TypeError de red a ApiError(0)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const e = await capturar(apiFetch('/health', { auth: false }))
    expect(e.status).toBe(0)
    expect(e.message).toBe(MENSAJE_SIN_CONEXION)
  })

  it('mapea el timeout a ApiError(408)', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_res, rej) => {
          init?.signal?.addEventListener('abort', () =>
            rej(new DOMException('aborted', 'AbortError')),
          )
        }),
    )
    const promesa = capturar(apiFetch('/chat', { timeoutMs: 1000 }))
    await vi.advanceTimersByTimeAsync(1000)
    const e = await promesa
    expect(e.status).toBe(408)
    expect(e.message).toBe(MENSAJE_TIMEOUT)
  })

  it('la cancelacion externa no es un timeout', async () => {
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_res, rej) => {
          init?.signal?.addEventListener('abort', () =>
            rej(new DOMException('aborted', 'AbortError')),
          )
        }),
    )
    const controller = new AbortController()
    const promesa = apiFetch('/chat', { signal: controller.signal })
    controller.abort()
    await expect(promesa).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('apiFetch: 401', () => {
  it('refresca el token y reintenta una vez', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { detail: 'Token expirado.' }))
      .mockResolvedValueOnce(json(200, { status: 'ok' }))
    await expect(apiFetch('/history')).resolves.toEqual({ status: 'ok' })
    expect(refreshToken).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(login).not.toHaveBeenCalled()
  })

  it('llama a login() si el reintento vuelve a dar 401', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { detail: 'Token expirado.' }))
      .mockResolvedValueOnce(json(401, { detail: 'Token invalido.' }))
    const e = await capturar(apiFetch('/history'))
    expect(e.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(login).toHaveBeenCalledTimes(1)
  })
})

describe('mensajeDeError', () => {
  it('cubre ApiError, Error, cancelacion y valores desconocidos', () => {
    expect(mensajeDeError(new ApiError(404, 'No existe.'))).toBe('No existe.')
    expect(mensajeDeError(new Error('Algo fallo'))).toBe('Algo fallo')
    expect(mensajeDeError(new TypeError('Failed to fetch'))).toBe(MENSAJE_SIN_CONEXION)
    expect(mensajeDeError(new DOMException('x', 'AbortError'))).toBe('Se canceló la solicitud.')
    expect(mensajeDeError(null)).toBe('Ocurrió un error inesperado.')
  })
})
