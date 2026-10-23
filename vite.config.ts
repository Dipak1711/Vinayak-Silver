import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Dedicated dev port for this project so it never collides with other local apps.
// Override with: npm run dev -- --port 5200   (or)   PORT=5200 npm run dev
const PORT = Number(process.env.PORT) || 5180

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: PORT,
    // Fail with a clear message instead of silently hopping to another port.
    strictPort: true,
    host: true,
  },
  preview: {
    port: PORT,
    strictPort: true,
    host: true,
  },
})
