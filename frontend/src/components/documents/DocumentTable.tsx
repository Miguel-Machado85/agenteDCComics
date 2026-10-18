import type { DocumentoItem } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { formatearEntero, formatearFecha } from '../../utils/formato'

interface Props {
  items: DocumentoItem[]
  onEliminar: (doc: DocumentoItem) => void
}

const ORIGEN: Record<string, string> = { upload: 'Subido', dc_wiki: 'Wiki' }

const BOTON_ELIMINAR =
  'rounded-md border border-peligro/60 px-2.5 py-1 text-xs font-medium text-peligro hover:bg-peligro/20'

function Titulo({ doc }: { doc: DocumentoItem }) {
  if (!doc.url) return <span className="font-medium break-words">{doc.titulo}</span>
  return (
    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="font-medium break-words hover:underline">
      {doc.titulo}
    </a>
  )
}

function EtiquetaTuyo() {
  return (
    <span className="ml-2 inline-block rounded-full border border-acento/50 bg-acento/15 px-2 py-0.5 align-middle text-xs font-medium text-acento-fuerte">
      Tuyo
    </span>
  )
}

export default function DocumentTable({ items, onEliminar }: Props) {
  const { usuario } = useAuth()
  const esTuyo = (d: DocumentoItem) => !!usuario.sub && d.uploaded_by === usuario.sub
  const sePuedeBorrar = (d: DocumentoItem) => d.source === 'upload' && esTuyo(d)

  const botonEliminar = (d: DocumentoItem) => (
    <button
      type="button"
      onClick={() => onEliminar(d)}
      aria-label={`Eliminar ${d.titulo}`}
      className={BOTON_ELIMINAR}
    >
      Eliminar
    </button>
  )

  const chunks = (d: DocumentoItem) => `${formatearEntero(d.chunks)} ${d.chunks === 1 ? 'fragmento' : 'fragmentos'}`

  return (
    <>
      {/* Escritorio: tabla */}
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="border-b border-borde text-xs text-texto-suave uppercase">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">Título</th>
            <th scope="col" className="px-3 py-2 font-medium">Origen</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Fragmentos</th>
            <th scope="col" className="px-3 py-2 font-medium">Fecha</th>
            <th scope="col" className="py-2 pl-3 font-medium"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id} className="border-b border-borde/60 last:border-0">
              <td className="py-2.5 pr-3">
                <Titulo doc={d} />
                {esTuyo(d) && <EtiquetaTuyo />}
              </td>
              <td className="px-3 py-2.5 text-texto-suave">{ORIGEN[d.source] ?? d.source}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatearEntero(d.chunks)}</td>
              <td className="px-3 py-2.5 whitespace-nowrap text-texto-suave">{formatearFecha(d.creado)}</td>
              <td className="py-2.5 pl-3 text-right">{sePuedeBorrar(d) && botonEliminar(d)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Movil: tarjetas */}
      <ul className="flex flex-col gap-2 md:hidden">
        {items.map((d) => (
          <li key={d.id} className="rounded-md border border-borde bg-superficie p-3 text-sm">
            <p>
              <Titulo doc={d} />
              {esTuyo(d) && <EtiquetaTuyo />}
            </p>
            <p className="mt-1 text-xs text-texto-suave">
              {ORIGEN[d.source] ?? d.source} · {chunks(d)} · {formatearFecha(d.creado)}
            </p>
            {sePuedeBorrar(d) && <div className="mt-2">{botonEliminar(d)}</div>}
          </li>
        ))}
      </ul>
    </>
  )
}
