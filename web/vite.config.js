import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // web/.env (ARGOS_API_URL) or API_PROXY_TARGET: the API that dev requests are proxied to.
  const env = loadEnv(mode, process.cwd(), '')
  const api = process.env.API_PROXY_TARGET || env.ARGOS_API_URL || 'http://localhost:8080'

  return {
    plugins: [react()],
    server: {
      // Dev calls the API through this proxy (VITE_API_URL empty), so no CORS entry for
      // localhost is needed.
      proxy: {
        '/v1': { target: api, changeOrigin: true },
        '/health': { target: api, changeOrigin: true },
      },
    },
    test: {
      environment: 'node',
      env: { VITE_API_URL: 'https://argos-api.example.test' },
    },
  }
})
