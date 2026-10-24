import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const framingFile = fileURLToPath(new URL('./src/framing.json', import.meta.url))
const photosDir = fileURLToPath(new URL('./public/players', import.meta.url))

// `import photos from 'virtual:photos'` gives { 'team/character-slug': 'file.ext' } for every
// photo in public/players, so the site requests each photo's real file instead of guessing its type.
const PHOTO_ID = '\0virtual:photos'
const PHOTO_PREFERENCE = { webp: 0, png: 1, jpg: 2, jpeg: 2 }
const photoManifest = {
  name: 'photo-manifest',
  resolveId(id) {
    if (id === 'virtual:photos') return PHOTO_ID
  },
  load(id) {
    if (id !== PHOTO_ID) return
    const photos = {}
    const teams = existsSync(photosDir) ? readdirSync(photosDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()) : []
    for (const team of teams) {
      for (const file of readdirSync(join(photosDir, team.name))) {
        const match = file.match(/^(.+)\.(webp|png|jpe?g)$/i)
        if (!match) continue
        const key = `${team.name}/${match[1]}`
        const ext = match[2].toLowerCase()
        const current = photos[key]?.split('.').pop()
        if (!current || PHOTO_PREFERENCE[ext] < PHOTO_PREFERENCE[current]) photos[key] = file
      }
    }
    return `export default ${JSON.stringify(photos)}`
  },
  // Pick up photos added or removed while `npm run dev` is running.
  configureServer(server) {
    const refresh = (file) => {
      if (!file.startsWith(photosDir)) return
      const module = server.moduleGraph.getModuleById(PHOTO_ID)
      if (module) server.reloadModule(module)
    }
    server.watcher.on('add', refresh)
    server.watcher.on('unlink', refresh)
  },
}

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
  plugins: [react(), photoManifest, framingSaver],
  base: repositoryName ? `/${repositoryName}/` : '/',
})
