import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Las VITE_* se leen del .env de la raiz del repo (no hay .env en /frontend)
  envDir: '..',
  // Keycloak (redirectUris) y CORS del backend solo aceptan localhost:5173
  server: { port: 5173, strictPort: true },
})
