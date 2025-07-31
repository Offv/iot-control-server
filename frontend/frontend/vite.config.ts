import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: [
      'unit1htr.system',
      'unit2htr.system',
      'localhost'
    ],
    proxy: {
      '/mqtt': {
        target: 'ws://mqtt:9001',
        ws: true
      }
    },
    hmr: {
      clientPort: 80
    }
  }
})
