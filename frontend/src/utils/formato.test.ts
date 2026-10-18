import { describe, expect, it } from 'vitest'
import {
  formatearEntero,
  formatearFecha,
  formatearTamano,
  nivelSimilitud,
  similitudAPorcentaje,
} from './formato'

describe('similitudAPorcentaje', () => {
  it('redondea al entero mas cercano', () => {
    expect(similitudAPorcentaje(0.873)).toBe('87 %')
    expect(similitudAPorcentaje(0.875)).toBe('88 %')
    expect(similitudAPorcentaje(1)).toBe('100 %')
    expect(similitudAPorcentaje(0)).toBe('0 %')
  })
})

describe('nivelSimilitud', () => {
  it('respeta los umbrales 0.82 y 0.70 (inclusivos)', () => {
    expect(nivelSimilitud(0.95)).toBe('fuerte')
    expect(nivelSimilitud(0.82)).toBe('fuerte')
    expect(nivelSimilitud(0.8199)).toBe('aceptable')
    expect(nivelSimilitud(0.7)).toBe('aceptable')
    expect(nivelSimilitud(0.6999)).toBe('débil')
    expect(nivelSimilitud(0.1)).toBe('débil')
  })
})

describe('formatearFecha', () => {
  it('formatea un ISO valido en es-CO', () => {
    const iso = '2026-10-18T15:30:00Z'
    const esperado = new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
    expect(formatearFecha(iso)).toBe(esperado)
    expect(formatearFecha(iso)).toContain('2026')
  })

  it('devuelve el texto original si la fecha no es valida', () => {
    expect(formatearFecha('no-es-fecha')).toBe('no-es-fecha')
  })
})

describe('formatearTamano', () => {
  it('usa bytes por debajo de 1 KB', () => {
    expect(formatearTamano(0)).toBe('0 B')
    expect(formatearTamano(512)).toBe('512 B')
    expect(formatearTamano(1023)).toBe('1023 B')
  })

  it('usa KB y MB con coma decimal', () => {
    expect(formatearTamano(1024)).toBe('1 KB')
    expect(formatearTamano(1536)).toBe('1,5 KB')
    expect(formatearTamano(10 * 1024 * 1024)).toBe('10 MB')
    expect(formatearTamano(2.25 * 1024 * 1024)).toBe('2,3 MB')
  })
})

describe('formatearEntero', () => {
  it('agrupa miles con punto, tambien con 4 cifras', () => {
    expect(formatearEntero(0)).toBe('0')
    expect(formatearEntero(999)).toBe('999')
    expect(formatearEntero(1234)).toBe('1.234')
    expect(formatearEntero(1234567)).toBe('1.234.567')
  })
})
