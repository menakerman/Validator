/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'
import { PROTOCOL_PATH, handleProtocolRequest } from './server/kehilanetProxy.js'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // The Kehilanet protocol request cannot run in the browser (GET with a
    // body, Cookie header, no CORS headers upstream), so the dev server mounts
    // the same proxy handler that `npm start` serves in production.
    {
      name: 'kehilanet-protocol-proxy',
      configureServer(server) {
        server.middlewares.use(PROTOCOL_PATH, handleProtocolRequest)
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
