import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // O backend não habilita CORS: em desenvolvimento as chamadas a /api passam pelo proxy do Vite.
  const backendUrl = env.VITE_BACKEND_URL ?? 'http://localhost:8090'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
      },
    },
  }
})
