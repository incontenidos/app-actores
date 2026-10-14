import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: el build funciona en cualquier hosting estático (GitHub Pages, Netlify, etc.).
  base: './',
  plugins: [react()],
})
