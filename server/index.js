import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { loadSecrets } from './secrets.js'
import { initDatabase } from './database.js'
import { log } from './logger.js'
import healthRouter from './routes/health.js'
import proxyRouter from './routes/proxy.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Log any crash as a single line instead of a multi-line stack trace.
process.on('uncaughtException', (err) => log.error('uncaughtException', { err }))
process.on('unhandledRejection', (err) => log.error('unhandledRejection', { err }))

await loadSecrets()
await initDatabase()

const app = express()
const PORT = process.env.PORT || 8080

app.use(express.json({ limit: "25mb" }))

// Cross-origin isolation headers: required for the browser to grant
// SharedArrayBuffer, which is what lets the in-browser AI model
// (onnxruntime-web / transformers.js) run multi-threaded WASM instead of a
// single thread. Every resource this app loads (vendor scripts, the model
// files, proxied images) is served from this same origin via /api/hf and
// /api/img, so this is safe to turn on globally without breaking any
// cross-origin subresource loads.
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  // 'credentialless' (not 'require-corp') on purpose: it still grants
  // crossOriginIsolated (so SharedArrayBuffer / multi-threaded WASM works),
  // but without forcing every subresource to carry an explicit CORP header.
  // require-corp was observed to break other embedded tooling on this page
  // (anything loaded without an opt-in CORP header gets blocked outright);
  // credentialless just strips credentials from cross-origin requests
  // instead, which this app doesn't need anyway since every external
  // resource already goes through our own same-origin proxy.
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
  next()
})

// --- API ROUTES ---
// Add route files in server/routes/ and mount them here.
// Example: import usersRouter from './routes/users.js'
//          app.use('/api/users', usersRouter)

app.use('/api/health', healthRouter)
app.use('/api', proxyRouter)

// Catches errors thrown by API routes and logs them as a single line.
// Keep this below your route mounts and above static serving.
app.use('/api', (err, req, res, next) => {
  log.error('request failed', { err, path: req.path })
  res.status(err.status || 500).json({ error: 'Internal error' })
})

// --- STATIC SERVING (DO NOT EDIT BELOW) ---

const distPath = join(__dirname, '..', 'dist')
app.use(express.static(distPath))

app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  log.info('server started', { port: PORT })
})
