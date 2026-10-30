// One-time model bundling: downloads the RMBG-1.4 ONNX weights straight into
// public/models/ at BUILD time (this runs on Vibehost's build infra, which has
// real internet access — unlike the sandbox this was written in). Once bundled,
// the browser loads the model from our own domain on the very first visit,
// with zero request to huggingface.co. If this script fails for any reason
// (build environment has no route to huggingface.co, hub path changes, etc.)
// it exits 0 without failing the build — app.js checks whether the local file
// exists at runtime and transparently falls back to fetching it through our
// existing /api/hf proxy if it doesn't.
//
// Bundles the quantized (~44MB) weights. We tried bundling/proxying the
// larger fp16 (~88MB) and fp32 (~176MB) variants to get a cleaner
// segmentation mask, but direct testing against this deployment's own
// /api/hf proxy showed those larger files reliably fail with an instant
// gateway-level "upstream connect error" (503) — a hard size limit
// somewhere in front of this app that isn't something we can work around
// from app code. The quantized file is the only variant confirmed to load
// reliably here, so that's what gets bundled.
import { mkdir, writeFile, stat } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MODEL_ID = 'briaai/RMBG-1.4'
const FILE_PATH = 'onnx/model_quantized.onnx'
const SRC_URL = `https://huggingface.co/${MODEL_ID}/resolve/main/${FILE_PATH}`
const DEST = join(__dirname, '..', 'public', 'models', MODEL_ID, FILE_PATH)

async function alreadyPresent(path) {
  try {
    const s = await stat(path)
    return s.size > 1_000_000 // sanity check: a real model file, not a stub
  } catch {
    return false
  }
}

async function main() {
  if (await alreadyPresent(DEST)) {
    console.log('[fetch-model] already present, skipping download:', DEST)
    return
  }
  console.log('[fetch-model] downloading', SRC_URL)
  try {
    const res = await fetch(SRC_URL, { redirect: 'follow' })
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength < 1_000_000) throw new Error(`downloaded file looks too small (${buf.byteLength} bytes) — refusing to bundle a truncated model`)
    await mkdir(dirname(DEST), { recursive: true })
    await writeFile(DEST, buf)
    console.log('[fetch-model] saved', DEST, `(${(buf.byteLength / 1_048_576).toFixed(1)} MB)`)
  } catch (err) {
    console.warn('[fetch-model] could not bundle the model at build time, app will fall back to fetching it via /api/hf at runtime:', err.message)
    // Exit 0 on purpose — this must never fail the deploy.
  }
}

main()
