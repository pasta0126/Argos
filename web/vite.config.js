import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// API_PROXY_TARGET points dev at another deployment (e.g. before a host move).
const API = process.env.API_PROXY_TARGET || 'https://argos-api.northernarchive.com'

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev calls the production API through this proxy (VITE_API_URL empty), so no CORS
    // entry for localhost is needed.
    proxy: {
      '/v1': { target: API, changeOrigin: true },
      '/health': { target: API, changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
  },
})
