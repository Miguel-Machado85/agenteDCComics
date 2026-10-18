import { formatearTamano } from './formato'

/** Mismos formatos que acepta POST /documents. */
export const EXTENSIONES_PERMITIDAS = ['.pdf', '.txt', '.md', '.csv', '.docx'] as const

/** Valor para el atributo accept del input. */
export const ACCEPT = EXTENSIONES_PERMITIDAS.join(',')

/** MAX_UPLOAD_MB del backend (10 MB por defecto). */
export const TAMANO_MAXIMO_MB = 10
export const TAMANO_MAXIMO_BYTES = TAMANO_MAXIMO_MB * 1024 * 1024

/** "Informe.PDF" -> ".pdf"; "" si no tiene extension. */
export function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf('.')
  return punto > 0 ? nombre.slice(punto).toLowerCase() : ''
}

/**
 * Valida el archivo antes de enviarlo. Devuelve el mensaje de error listo para
 * mostrar, o null si se puede subir.
 */
export function validarArchivo(archivo: Pick<File, 'name' | 'size'>): string | null {
  const extension = extensionDe(archivo.name)
  if (!(EXTENSIONES_PERMITIDAS as readonly string[]).includes(extension)) {
    return `"${archivo.name}" no es un formato soportado. Usa PDF, TXT, MD, CSV o DOCX.`
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    return `"${archivo.name}" pesa ${formatearTamano(archivo.size)}; el máximo es ${TAMANO_MAXIMO_MB} MB.`
  }
  return null
}
