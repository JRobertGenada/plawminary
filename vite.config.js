import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function swPrecachePlugin() {
  return {
    name: 'plawminary-sw-precache',
    apply: 'build',
    closeBundle() {
      const swDistPath = resolve(__dirname, 'dist/sw.js')
      if (!existsSync(swDistPath)) return

      const assetsDir = resolve(__dirname, 'dist/assets')
      const assetFiles = []
      if (existsSync(assetsDir)) {
        const files = readdirSync(assetsDir)
        for (const file of files) {
          if (!file.endsWith('.map')) {
            assetFiles.push(`/assets/${file}`)
          }
        }
      }

      let content = readFileSync(swDistPath, 'utf-8')
      const placeholder = '/* __VITE_ASSETS_PLACEHOLDER__ */'
      if (content.includes(placeholder)) {
        const formatted = assetFiles.map((f) => `  ${JSON.stringify(f)}`).join(',\n')
        content = content.replace(placeholder, formatted)
        writeFileSync(swDistPath, content, 'utf-8')
        console.log(`[SW-Plugin] Injected ${assetFiles.length} production assets into dist/sw.js`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), swPrecachePlugin()],
  assetsInclude: ['**/*.pdf'],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})


