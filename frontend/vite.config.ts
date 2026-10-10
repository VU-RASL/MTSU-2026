import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // string shorthand:
      // http://localhost:5173/foo
      '/api': 'http://localhost:18080',
      // with options:
      // http://localhost:5173/api/persona
    },
  },
})
