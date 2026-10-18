import { useCallback, useEffect, useRef, useState } from 'react'
import { enviarPregunta, obtenerHistorial } from '../api/chat'
import { esCancelacion, mensajeDeError } from '../api/client'
import type { EntradaHistorial, Fuente } from '../api/types'

export type Mensaje =
  | { id: string; tipo: 'usuario'; texto: string }
  | {
      id: string
      tipo: 'agente'
      respuesta: string
      rechazada: boolean
      /** Las entradas del historial no la traen. */
      intencion?: string
      fuentes: Fuente[]
    }
  | { id: string; tipo: 'error'; texto: string; pregunta: string }

const LIMITE_HISTORIAL = 10

let siguienteId = 0
const nuevoId = (prefijo: string) => `${prefijo}-${++siguienteId}`

/** Una entrada del historial -> burbuja del usuario + burbuja del agente. */
function aBurbujas(entrada: EntradaHistorial): Mensaje[] {
  return [
    { id: `h-${entrada.id}-u`, tipo: 'usuario', texto: entrada.pregunta },
    {
      id: `h-${entrada.id}-a`,
      tipo: 'agente',
      respuesta: entrada.respuesta,
      rechazada: entrada.rechazada,
      fuentes: entrada.fuentes,
    },
  ]
}

/**
 * Estado del chat: carga las ultimas preguntas al montar y envia las nuevas.
 * Al desmontar cancela cualquier peticion en curso.
 */
export function useChat() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [enviando, setEnviando] = useState(false)
  const [cargandoHistorial, setCargandoHistorial] = useState(true)
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null)

  // Cambiarlo vuelve a pedir la conversacion anterior (boton Reintentar)
  const [intentoHistorial, setIntentoHistorial] = useState(0)

  const controllerRef = useRef<AbortController | null>(null)
  const enviandoRef = useRef(false)

  // Controller de los envios: se cancela solo al desmontar
  useEffect(() => {
    const controller = new AbortController()
    controllerRef.current = controller
    return () => {
      controller.abort()
      enviandoRef.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    obtenerHistorial({ limit: LIMITE_HISTORIAL }, controller.signal)
      .then((entradas) => {
        // Llega lo mas reciente primero: se invierte para mostrarlo en orden
        const previos = [...entradas].reverse().flatMap(aBurbujas)
        setMensajes((actuales) => [...previos, ...actuales])
        setCargandoHistorial(false)
      })
      .catch((e: unknown) => {
        if (esCancelacion(e)) return
        setErrorHistorial(mensajeDeError(e))
        setCargandoHistorial(false)
      })

    return () => controller.abort()
  }, [intentoHistorial])

  const recargarHistorial = useCallback(() => {
    setErrorHistorial(null)
    setCargandoHistorial(true)
    setIntentoHistorial((n) => n + 1)
  }, [])

  const pedir = useCallback(async (pregunta: string, agregarUsuario: boolean) => {
    const texto = pregunta.trim()
    if (!texto || enviandoRef.current) return
    const signal = controllerRef.current?.signal

    enviandoRef.current = true
    setEnviando(true)
    if (agregarUsuario) {
      setMensajes((actuales) => [...actuales, { id: nuevoId('u'), tipo: 'usuario', texto }])
    }

    try {
      const r = await enviarPregunta(texto, signal)
      setMensajes((actuales) => [
        ...actuales,
        {
          id: nuevoId('a'),
          tipo: 'agente',
          respuesta: r.respuesta,
          rechazada: r.rechazada,
          intencion: r.intencion,
          fuentes: r.fuentes,
        },
      ])
    } catch (e) {
      // Pagina desmontada: no hay nada que actualizar
      if (esCancelacion(e)) return
      setMensajes((actuales) => [
        ...actuales,
        { id: nuevoId('e'), tipo: 'error', texto: mensajeDeError(e), pregunta: texto },
      ])
    }
    enviandoRef.current = false
    setEnviando(false)
  }, [])

  const enviar = useCallback((pregunta: string) => pedir(pregunta, true), [pedir])

  /** Quita la burbuja de error y reenvia su pregunta sin duplicar la del usuario. */
  const reintentar = useCallback(
    (idError: string) => {
      if (enviandoRef.current) return
      const error = mensajes.find((m) => m.id === idError)
      if (!error || error.tipo !== 'error') return
      setMensajes((actuales) => actuales.filter((m) => m.id !== idError))
      void pedir(error.pregunta, false)
    },
    [mensajes, pedir],
  )

  return {
    mensajes,
    enviando,
    cargandoHistorial,
    errorHistorial,
    enviar,
    reintentar,
    recargarHistorial,
  }
}
