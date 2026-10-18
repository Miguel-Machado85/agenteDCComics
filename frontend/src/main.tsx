import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Valida las VITE_* al arrancar: si falta una, falla aqui con un mensaje claro
import './config'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { initKeycloak, realmUrl } from './auth/keycloak'

const root = document.getElementById('root')!

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function mostrarCarga() {
  root.innerHTML = `
    <div class="flex min-h-screen items-center justify-center px-4">
      <p class="text-texto-suave">Conectando con el servidor de autenticación…</p>
    </div>`
}

function mostrarError(error: unknown) {
  console.error('Fallo al inicializar Keycloak:', error)
  root.innerHTML = `
    <div class="flex min-h-screen items-center justify-center px-4">
      <div class="w-full max-w-md rounded-lg border border-borde bg-superficie p-6 text-center">
        <h1 class="mb-2 text-lg text-peligro">No se pudo conectar con el servidor de autenticación</h1>
        <p class="mb-1 text-sm text-texto-suave">Se intentó usar:</p>
        <p class="mb-5 break-all font-mono text-sm text-texto">${escapar(realmUrl)}</p>
        <button id="reintentar" type="button"
          class="rounded-md bg-acento px-4 py-2 text-sm font-medium text-white hover:bg-acento-fuerte">
          Reintentar
        </button>
      </div>
    </div>`
  // Recargar: una instancia de keycloak-js no se puede inicializar dos veces
  document.getElementById('reintentar')!.addEventListener('click', () => {
    window.location.reload()
  })
}

mostrarCarga()

initKeycloak()
  .then(() => {
    root.innerHTML = ''
    createRoot(root).render(
      <StrictMode>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </StrictMode>,
    )
  })
  .catch(mostrarError)
