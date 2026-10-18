import { describe, expect, it } from 'vitest'
import { ACCEPT, extensionDe, TAMANO_MAXIMO_BYTES, validarArchivo } from './archivos'

const archivo = (name: string, size = 1024) => ({ name, size })

describe('extensionDe', () => {
  it('devuelve la extension en minusculas', () => {
    expect(extensionDe('Informe.PDF')).toBe('.pdf')
    expect(extensionDe('notas.tar.md')).toBe('.md')
  })

  it('devuelve "" sin extension o con solo un punto inicial', () => {
    expect(extensionDe('LEEME')).toBe('')
    expect(extensionDe('.env')).toBe('')
  })
})

describe('validarArchivo', () => {
  it.each(['a.pdf', 'a.txt', 'a.md', 'a.csv', 'a.docx', 'A.PDF', 'Notas.Docx'])(
    'acepta %s',
    (nombre) => {
      expect(validarArchivo(archivo(nombre))).toBeNull()
    },
  )

  it.each(['virus.exe', 'foto.png', 'LEEME', 'archivo.pdf.exe', 'viejo.doc'])(
    'rechaza %s por formato',
    (nombre) => {
      expect(validarArchivo(archivo(nombre))).toMatch(/no es un formato soportado/)
    },
  )

  it('acepta exactamente 10 MB', () => {
    expect(validarArchivo(archivo('a.pdf', TAMANO_MAXIMO_BYTES))).toBeNull()
  })

  it('rechaza 10 MB + 1 byte', () => {
    expect(validarArchivo(archivo('a.pdf', TAMANO_MAXIMO_BYTES + 1))).toMatch(
      /el máximo es 10 MB/,
    )
  })

  it('revisa el formato antes que el tamaño', () => {
    expect(validarArchivo(archivo('a.exe', TAMANO_MAXIMO_BYTES * 2))).toMatch(
      /no es un formato soportado/,
    )
  })
})

describe('ACCEPT', () => {
  it('lista las extensiones para el input', () => {
    expect(ACCEPT).toBe('.pdf,.txt,.md,.csv,.docx')
  })
})
