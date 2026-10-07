import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Cada compilación lleva un sello. La app lo compara con /version.json para
// avisar cuando hay una versión nueva publicada.
const sello = String(Date.now())

function versionPublicada() {
  return {
    name: 'version-publicada',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: sello }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionPublicada()],
  define: { __VERSION__: JSON.stringify(sello) },
})
