import { foldkit } from '@foldkit/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

import { serviceWorker } from './scripts/vite-plugin-service-worker.ts'

export default defineConfig({
  plugins: [tailwindcss(), foldkit(), serviceWorker()],
  server: { port: 3000, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Effect + Foldkit land in one ~200 kB (gzip) chunk; the service worker
    // caches it after the first visit, so splitting buys little.
    chunkSizeWarningLimit: 800,
  },
})
