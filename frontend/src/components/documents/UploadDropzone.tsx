import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, esCancelacion, mensajeDeError } from '../../api/client'
import { subirDocumento } from '../../api/documents'
import type { DocumentoSubido } from '../../api/types'
import { ACCEPT, TAMANO_MAXIMO_MB, validarArchivo } from '../../utils/archivos'
import { formatearTamano } from '../../utils/formato'

type Estado =
  | { tipo: 'inactivo' }
  | { tipo: 'subiendo'; nombre: string; tamano: number }
  | { tipo: 'exito'; resultado: DocumentoSubido }
  | { tipo: 'error'; mensaje: string }

const MENSAJES_SUBIDA: Record<number, string> = {
  413: `El archivo es demasiado grande: el máximo es ${TAMANO_MAXIMO_MB} MB.`,
  415: 'Formato no soportado. Usa PDF, TXT, MD, CSV o DOCX.',
  422: 'No se pudo extraer texto del archivo. Si es un PDF escaneado, no tiene texto seleccionable.',
}

function mensajeDeSubida(e: unknown): string {
  if (e instanceof ApiError && MENSAJES_SUBIDA[e.status]) return MENSAJES_SUBIDA[e.status]
  return mensajeDeError(e)
}

interface Props {
  /** Se llama tras una subida correcta (para recargar la lista). */
  onSubido?: (doc: DocumentoSubido) => void
}

export default function UploadDropzone({ onSubido }: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'inactivo' })
  const [arrastrando, setArrastrando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const subiendo = estado.tipo === 'subiendo'

  // Al desmontar cancela la subida en curso
  useEffect(() => () => controllerRef.current?.abort(), [])

  async function subir(archivos: FileList | File[] | null) {
    if (subiendo || !archivos || archivos.length === 0) return
    if (archivos.length > 1) {
      setEstado({ tipo: 'error', mensaje: 'Sube un archivo a la vez.' })
      return
    }
    const archivo = archivos[0]
    const invalido = validarArchivo(archivo)
    if (invalido) {
      setEstado({ tipo: 'error', mensaje: invalido })
      return
    }

    const controller = new AbortController()
    controllerRef.current = controller
    setEstado({ tipo: 'subiendo', nombre: archivo.name, tamano: archivo.size })
    try {
      const resultado = await subirDocumento(archivo, controller.signal)
      setEstado({ tipo: 'exito', resultado })
      onSubido?.(resultado)
    } catch (e) {
      if (esCancelacion(e)) return
      setEstado({ tipo: 'error', mensaje: mensajeDeSubida(e) })
    }
  }

  function alSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setArrastrando(false)
    if (subiendo) return
    void subir(e.dataTransfer.files)
  }

  function alArrastrar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!subiendo) setArrastrando(true)
  }

  return (
    <section aria-labelledby="titulo-subir" className="flex flex-col gap-3">
      <h2 id="titulo-subir" className="text-3xl">
        Subir un documento
      </h2>

      <div
        data-testid="dropzone"
        aria-disabled={subiendo}
        onDragOver={alArrastrar}
        onDragEnter={alArrastrar}
        onDragLeave={(e) => {
          // Pasar sobre un hijo tambien dispara dragleave: solo cuenta salir de la zona
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastrando(false)
        }}
        onDrop={alSoltar}
        className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
          subiendo
            ? 'cursor-not-allowed border-borde opacity-70'
            : arrastrando
              ? 'border-acento-fuerte bg-acento/5'
              : 'border-borde bg-superficie'
        }`}
      >
        {subiendo ? (
          <div role="status" className="flex flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-acento-fuerte border-t-transparent"
            />
            <p className="font-medium break-all">
              {estado.nombre}{' '}
              <span className="text-sm text-texto-suave">({formatearTamano(estado.tamano)})</span>
            </p>
            <p className="text-sm text-texto-suave">
              Procesando: extrayendo texto y generando embeddings…
            </p>
          </div>
        ) : (
          <>
            <p>
              Arrastra un archivo aquí o{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="boton boton-primario ml-1"
              >
                Elegir archivo
              </button>
            </p>
            <p className="text-xs text-texto-suave">
              PDF, TXT, MD, CSV o DOCX · máximo {TAMANO_MAXIMO_MB} MB · un archivo a la vez
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Elegir archivo"
          disabled={subiendo}
          onChange={(e) => {
            const archivos = e.target.files ? Array.from(e.target.files) : null
            // Permite volver a elegir el mismo archivo
            e.target.value = ''
            void subir(archivos)
          }}
        />
      </div>

      {estado.tipo === 'error' && (
        <p role="alert" className="rounded-md border border-peligro/60 bg-peligro/10 px-3 py-2 text-sm text-peligro">
          {estado.mensaje}
        </p>
      )}

      {estado.tipo === 'exito' && (
        <div role="status" className="rounded-md border border-exito/50 bg-exito/10 px-3 py-2 text-sm">
          <p className="font-medium text-exito">
            <span aria-hidden="true">✓ </span>
            {estado.resultado.mensaje}
          </p>
          <p className="text-texto-suave">
            «{estado.resultado.titulo}» · {estado.resultado.chunks}{' '}
            {estado.resultado.chunks === 1 ? 'fragmento' : 'fragmentos'}
          </p>
          <Link to="/chat" className="mt-1 inline-block font-medium hover:underline">
            Preguntar sobre este documento →
          </Link>
        </div>
      )}
    </section>
  )
}
