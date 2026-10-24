import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const framingFile = fileURLToPath(new URL('./src/framing.json', import.meta.url))

// Local-only: lets the photo framing editor save src/framing.json while `npm run dev` runs.
const framingSaver = {
  name: 'framing-saver',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__framing', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        return res.end()
      }
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        try {
          const data = JSON.parse(body)
          const sorted = Object.fromEntries(Object.keys(data).sort().map((key) => [key, data[key]]))
          writeFileSync(framingFile, `${JSON.stringify(sorted, null, 2)}\n`)
          res.end('ok')
        } catch (error) {
          res.statusCode = 400
          res.end(String(error))
        }
      })
    })
  },
  // The editor already holds the new values, so skip reloading the page on save.
  handleHotUpdate({ file }) {
    if (file === framingFile.replace(/\\/g, '/') || file === framingFile) return []
  },
}

export default defineConfig({
  plugins: [react(), framingSaver],
  base: repositoryName ? `/${repositoryName}/` : '/',
})
