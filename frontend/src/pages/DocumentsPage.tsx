import { useState } from 'react'
import { ApiError, mensajeDeError } from '../api/client'
import { borrarDocumento } from '../api/documents'
import type { DocumentoItem, DocumentoSubido } from '../api/types'
import DeleteConfirm from '../components/documents/DeleteConfirm'
import DocumentTable from '../components/documents/DocumentTable'
import DocumentTabs from '../components/documents/DocumentTabs'
import UploadDropzone from '../components/documents/UploadDropzone'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'
import Pagination from '../components/ui/Pagination'
import { SkeletonLista } from '../components/ui/Skeleton'
import { useDocuments } from '../hooks/useDocuments'
import { useTituloPagina } from '../hooks/useTituloPagina'
import { formatearEntero } from '../utils/formato'

const PANEL_ID = 'panel-documentos'

const MENSAJE_403 = 'Solo puedes borrar documentos que subiste tú.'
const MENSAJE_404 = 'El documento ya no existía; se actualizó la lista.'

export default function DocumentsPage() {
  useTituloPagina('Documentos')
  const docs = useDocuments('upload')
  const [aBorrar, setABorrar] = useState<DocumentoItem | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  // Si se borra lo recien subido, se reinicia la zona para quitar su mensaje de exito
  const [ultimoSubido, setUltimoSubido] = useState<number | null>(null)
  const [claveSubida, setClaveSubida] = useState(0)

  function quitarDeLaLista(id: number) {
    if (id === ultimoSubido) {
      setUltimoSubido(null)
      setClaveSubida((k) => k + 1)
    }
    setABorrar(null)
    docs.recargar()
  }

  function abrirBorrar(doc: DocumentoItem) {
    setAviso(null)
    setErrorBorrar(null)
    setABorrar(doc)
  }

  async function confirmarBorrar() {
    if (!aBorrar) return
    setEliminando(true)
    setErrorBorrar(null)
    try {
      await borrarDocumento(aBorrar.id)
      setAviso(`Se eliminó «${aBorrar.titulo}».`)
      quitarDeLaLista(aBorrar.id)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setAviso(MENSAJE_404)
        quitarDeLaLista(aBorrar.id)
      } else {
        setErrorBorrar(e instanceof ApiError && e.status === 403 ? MENSAJE_403 : mensajeDeError(e))
      }
    }
    setEliminando(false)
  }

  function alSubir(doc: DocumentoSubido) {
    setAviso(null)
    setUltimoSubido(doc.id)
    if (docs.source === 'upload' && docs.pagina === 1) docs.recargar()
    else docs.cambiarSource('upload')
  }

  const esWiki = docs.source === 'dc_wiki'

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-5xl">Documentos</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Lo que subas aquí se suma a las fuentes del agente junto con la wiki de DC.
        </p>
      </div>

      <UploadDropzone key={claveSubida} onSubido={alSubir} />

      <section aria-labelledby="titulo-lista" className="flex flex-col gap-4">
        <h2 id="titulo-lista" className="sr-only">
          Documentos indexados
        </h2>
        <DocumentTabs activa={docs.source} onCambiar={docs.cambiarSource} panelId={PANEL_ID} />

        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={`pestana-${docs.source}`}
          aria-busy={docs.cargando}
          className="flex flex-col gap-4"
        >
          {aviso && (
            <p role="status" className="rounded-md border border-borde bg-superficie px-3 py-2 text-sm">
              {aviso}
            </p>
          )}

          {docs.error ? (
            <ErrorBanner
              titulo="No se pudo cargar la lista de documentos"
              mensaje={docs.error}
              onReintentar={docs.recargar}
            />
          ) : docs.cargando && docs.items.length === 0 ? (
            <SkeletonLista etiqueta="Cargando documentos…" />
          ) : docs.total === 0 ? (
            esWiki ? (
              <EmptyState
                titulo="La wiki aún no está cargada"
                descripcion="No hay páginas de la wiki indexadas en la base de datos."
              />
            ) : (
              <EmptyState
                titulo="Aún no has subido documentos"
                descripcion="Sube un PDF, TXT, MD, CSV o DOCX para que el agente pueda responder sobre él."
              />
            )
          ) : (
            <>
              <p className="text-sm text-texto-suave">
                {formatearEntero(docs.total)} {docs.total === 1 ? 'documento' : 'documentos'}
                {docs.cargando && <span aria-hidden="true"> · cargando…</span>}
              </p>
              <div className={docs.cargando ? 'opacity-60 transition-opacity' : undefined}>
                <DocumentTable items={docs.items} onEliminar={abrirBorrar} />
              </div>
              <Pagination
                pagina={docs.pagina}
                totalPaginas={docs.totalPaginas}
                onCambiar={docs.irAPagina}
                deshabilitado={docs.cargando}
              />
            </>
          )}
        </div>
      </section>

      {aBorrar && (
        <DeleteConfirm
          documento={aBorrar}
          eliminando={eliminando}
          error={errorBorrar}
          onConfirmar={() => void confirmarBorrar()}
          onCancelar={() => setABorrar(null)}
        />
      )}
    </div>
  )
}
