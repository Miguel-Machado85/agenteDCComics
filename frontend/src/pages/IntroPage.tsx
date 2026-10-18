import { Link, useNavigate } from 'react-router-dom'
import { EJEMPLOS } from '../components/chat/ejemplos'
import { SuperBotRetrato } from '../components/superbot/SuperBot'
import { useTituloPagina } from '../hooks/useTituloPagina'
import type { EstadoChat } from './ChatPage'

const PASOS = [
  {
    titulo: 'Me haces una pregunta',
    texto: 'Sobre un héroe, un villano, un equipo o cualquier evento del multiverso.',
  },
  {
    titulo: 'Reviso mis archivos',
    texto: 'Busco en la wiki de DC y en los documentos que la comunidad ha subido.',
  },
  {
    titulo: 'Te respondo con pruebas',
    texto: 'Cada respuesta trae los fragmentos que usé. Si algo no está en mis archivos, te lo digo.',
  },
]

export default function IntroPage() {
  useTituloPagina('Inicio')
  const navigate = useNavigate()

  const preguntar = (pregunta: string) => {
    const estado: EstadoChat = { pregunta }
    navigate('/chat', { state: estado })
  }

  return (
    <div className="flex flex-col">
      <section
        aria-labelledby="titulo-intro"
        className="tramado corte-diagonal relative overflow-hidden bg-noche text-white [--corte:2.5rem] sm:[--corte:4.5rem]"
      >
        <div className="mx-auto grid max-w-5xl items-center gap-6 px-4 pt-8 pb-20 sm:pt-12 sm:pb-28 md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] md:gap-10">
          <div className="relative mx-auto w-44 sm:w-56 md:w-full md:max-w-xs">
            {/* Franja azul inclinada detras del retrato: el "corte" de las portadas de DC */}
            <div aria-hidden="true" className="absolute inset-x-[12%] -top-24 bottom-0 -skew-x-12 bg-acento md:-bottom-24" />
            <SuperBotRetrato className="relative w-full drop-shadow-[6px_6px_0_rgb(0_0_0/0.45)]" />
          </div>

          <div>
            <h1 id="titulo-intro" className="text-[3.6rem] sm:text-7xl lg:text-[6.5rem]">
              ¡Hola, soy SuperBot!
            </h1>
            <div className="mt-5 max-w-[62ch] space-y-3 text-lg text-white/85">
              <p>
                El fan número uno de todo lo relacionado con los héroes y villanos de este
                universo. He pasado años estudiando a los héroes, villanos y eventos que han
                ocurrido en nuestro multiverso, y he logrado reunir un extenso conocimiento sobre
                ellos (¡incluidas algunas identidades secretas!).
              </p>
              <p>
                Ahora quiero compartir ese conocimiento con todo el mundo. Pregunta lo que quieras
                sobre tus héroes o villanos favoritos y responderé lo mejor que pueda con lo que
                sé.
              </p>
            </div>
            <Link to="/chat" className="boton boton-primario mt-7 px-7 py-2.5 text-xl">
              Hazme una pregunta
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-4 pt-6 pb-16 sm:pt-4">
        <section aria-labelledby="titulo-ejemplos">
          <h2 id="titulo-ejemplos" className="text-4xl">
            ¿Por dónde empezamos?
          </h2>
          <p className="mt-2 text-texto-suave">Toca una pregunta y te respondo en el chat.</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {EJEMPLOS.map((ejemplo) => (
              <li key={ejemplo}>
                <button
                  type="button"
                  onClick={() => preguntar(ejemplo)}
                  className="rounded-full border-2 border-tinta bg-superficie px-4 py-1.5 font-semibold transition-colors hover:border-acento hover:bg-acento hover:text-white"
                >
                  {ejemplo}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="titulo-pasos">
          <h2 id="titulo-pasos" className="text-4xl">
            Cómo respondo
          </h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-8">
            {PASOS.map((paso, i) => (
              <li key={paso.titulo} className="border-t-4 border-tinta pt-3">
                <span aria-hidden="true" className="font-titulo text-6xl leading-none font-extrabold text-acento">
                  {i + 1}
                </span>
                <h3 className="mt-2 text-lg">{paso.titulo}</h3>
                <p className="mt-1 text-texto-suave">{paso.texto}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-texto-suave">
            ¿Tienes un archivo que yo no conozca?{' '}
            <Link to="/documentos" className="font-semibold">
              Súbelo en Documentos
            </Link>{' '}
            y lo sumo a mis archivos.
          </p>
        </section>
      </div>
    </div>
  )
}
