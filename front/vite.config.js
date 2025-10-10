import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins:[react()],
  server:{
    host:'0.0.0.0',
    port:5000,
    cors: true,
    allowedHosts: true,
    proxy: {
      '/agente': {
        target: 'http://localhost:6060',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/agente/, '')
      },
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/proxy': {
        target: 'http://localhost:5050',
        changeOrigin: true
      }
    }
  }
})
