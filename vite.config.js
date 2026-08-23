import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Must match the GitHub Pages repo path, or the deployed bundle 404s on assets.
  base: '/Vizuly/',
  plugins: [react()],
})
