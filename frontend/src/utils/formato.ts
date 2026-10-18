export type NivelSimilitud = 'fuerte' | 'aceptable' | 'débil'

const UMBRAL_FUERTE = 0.82
const UMBRAL_ACEPTABLE = 0.7

/** 0.873 -> "87 %". */
export function similitudAPorcentaje(similitud: number): string {
  return `${Math.round(similitud * 100)} %`
}

/** Clasifica la similitud coseno de una fuente. */
export function nivelSimilitud(similitud: number): NivelSimilitud {
  if (similitud >= UMBRAL_FUERTE) return 'fuerte'
  if (similitud >= UMBRAL_ACEPTABLE) return 'aceptable'
  return 'débil'
}

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** Fecha ISO del backend -> texto legible en espanol de Colombia. */
export function formatearFecha(iso: string): string {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? iso : formatoFecha.format(fecha)
}

// 'always': en espanol no se agrupan por defecto los numeros de 4 cifras
const formatoEntero = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
  useGrouping: 'always',
})

/** 1234 -> "1.234". */
export function formatearEntero(n: number): string {
  return formatoEntero.format(n)
}

const formatoNumero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
const UNIDADES = ['KB', 'MB', 'GB']

/** Bytes -> "512 B", "1,5 KB", "10 MB". */
export function formatearTamano(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) {
    return `${Math.max(0, Math.round(bytes || 0))} B`
  }
  let valor = bytes
  let unidad = -1
  while (valor >= 1024 && unidad < UNIDADES.length - 1) {
    valor /= 1024
    unidad++
  }
  return `${formatoNumero.format(valor)} ${UNIDADES[unidad]}`
}
