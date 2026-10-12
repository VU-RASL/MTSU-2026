import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
<<<<<<< HEAD
      // string shorthand:
      // http://localhost:5173/foo
      '/api': 'http://localhost:18080',
      // with options:
      // http://localhost:5173/api/persona
=======
      // Compose uses the backend service name; local development uses localhost.
      '/api': process.env.API_PROXY_TARGET || 'http://localhost:18080',
>>>>>>> origin/main
    },
  },
})
