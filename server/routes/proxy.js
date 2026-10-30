import { Router } from 'express'
import { log } from '../logger.js'
import https from 'https'

const router = Router()

// Create HTTPS agent that ignores SSL certificate verification
// Required for self-signed certificates in internal APIs
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

// Whitelist of users allowed to use Gemini AI enhancement
const GEMINI_WHITELIST = new Set([
  'alya.abdooli@talabat.com',
  'faisal.khazi@talabat.com',
  'harish.daliboyina@talabat.com',
  'krishna.sabbi@talabat.com',
  'veeraraghava.krishna@talabat.com',
  'reem.alraisi@talabat.com',
  'saranya.raghunathan@talabat.com',
  'chaitanya.c@talabat.com',
  'yara.burhan@talabat.com'
])

// Middleware: Check if user is authorized for Gemini
function checkGeminiAccess(req, res, next) {
  const userEmail = req.headers['x-user-email'] || req.query.userEmail
  if (!userEmail) {
    return res.status(401).json({ error: 'User email required' })
  }
  if (!GEMINI_WHITELIST.has(userEmail)) {
    log.warn('gemini-access-denied', { email: userEmail })
    return res.status(403).json({ error: 'Access denied: Gemini enhancement not available for this user' })
  }
  req.userEmail = userEmail
  next()
}

async function stream(upstream, res) {
  const reader = upstream.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    res.write(Buffer.from(value))
  }
  res.end()
}

// --- In-memory cache for large, content-addressed model files ---
// The platform gives us no persistent disk, but a plain in-process cache
// still helps enormously: once ONE request successfully downloads a model
// file from Hugging Face, every subsequent run (this user or any other,
// until the container restarts) is served instantly from RAM instead of
// re-downloading tens/hundreds of MB from Hugging Face each time. This is
// what was causing "the model downloads every run" and the general slowness.
const HF_CACHE = new Map() // path -> { buf: Buffer, contentType: string, size: number }
const HF_CACHE_INFLIGHT = new Map() // path -> Promise (de-dupe concurrent identical requests)
let hfCacheBytes = 0
// Kept modest on purpose: the container has limited memory, and the app now
// only ever requests the small quantized model (~44MB) plus a few tiny config
// files, so this is comfortably enough without risking memory pressure.
const HF_CACHE_MAX_BYTES = 150 * 1024 * 1024 // ~150MB budget for cached model files
// Files larger than this are streamed straight through, never buffered fully
// in memory — protects the container if something unexpectedly large is requested.
const HF_MAX_BUFFERABLE = 120 * 1024 * 1024

function hfCacheEvictIfNeeded(need) {
  if (hfCacheBytes + need <= HF_CACHE_MAX_BYTES) return
  // Simple oldest-first eviction (Map preserves insertion order) — fine since
  // in practice only a couple of large model files are ever cached at once.
  for (const [key, entry] of HF_CACHE) {
    if (hfCacheBytes + need <= HF_CACHE_MAX_BYTES) break
    HF_CACHE.delete(key)
    hfCacheBytes -= entry.size
  }
}

async function fetchWithRetry(url, attempts = 3) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow' })
      if (r.ok && r.body) return r
      lastErr = new Error(`Upstream ${r.status}`)
      // Retry on 5xx / 429 (transient); don't retry on a clean 404 etc.
      if (r.status < 500 && r.status !== 429) return r
    } catch (e) {
      lastErr = e
    }
    if (i < attempts - 1) await new Promise(res => setTimeout(res, 400 * (i + 1)))
  }
  throw lastErr
}

// --- Diagnostic: does THIS server have outbound internet access? ---
// Open https://bg-remover.lths.ai/api/diag in a browser to check.
router.get('/diag', async (req, res) => {
  const out = {}
  const check = async (label, url) => {
    const t = Date.now()
    try {
      const r = await fetch(url, { method: 'GET', redirect: 'follow' })
      out[label] = { ok: r.ok, status: r.status, ms: Date.now() - t }
    } catch (e) {
      out[label] = { ok: false, error: String(e?.cause?.code || e?.message || e), ms: Date.now() - t }
    }
  }
  await check('hf', 'https://huggingface.co/briaai/RMBG-1.4/resolve/main/config.json')
  await check('jsdelivr', 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/package.json')
  await check('litellm', 'https://litellm.dhhmena.com/health/liveliness')
  res.json({ serverHasInternet: Object.values(out).some(v => v.ok), checks: out })
})

// --- Model proxy: /api/hf/<path> -> https://huggingface.co/<path> ---
// Cached in memory after the first successful fetch (see HF_CACHE above), and
// retried a couple of times on transient upstream failures before giving up.
router.get('/hf/*', async (req, res) => {
  const path = req.params[0] || ''
  const target = 'https://huggingface.co/' + path

  const cached = HF_CACHE.get(path)
  if (cached) {
    res.setHeader('Content-Type', cached.contentType)
    res.setHeader('Content-Length', String(cached.size))
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('X-Cache', 'HIT')
    return res.end(cached.buf)
  }

  // De-dupe: if several requests for the same file arrive while it's still
  // downloading (e.g. model + processor loading concurrently), only fetch once.
  // (Skipped for streamed/uncacheable entries — a ReadableStream can only be
  // consumed once, so each concurrent request just does its own fetch there.)
  if (HF_CACHE_INFLIGHT.has(path)) {
    try {
      const entry = await HF_CACHE_INFLIGHT.get(path)
      if (!entry.stream) {
        res.setHeader('Content-Type', entry.contentType)
        res.setHeader('Content-Length', String(entry.size))
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        res.setHeader('X-Cache', 'HIT')
        return res.end(entry.buf)
      }
    } catch (e) {
      // fall through to a fresh attempt below
    }
  }

  const doFetch = (async () => {
    const upstream = await fetchWithRetry(target, 3)
    if (!upstream.ok || !upstream.body) {
      throw Object.assign(new Error(`Upstream ${upstream.status}`), { status: upstream.status })
    }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const reportedLen = Number(upstream.headers.get('content-length') || 0)
    // Anything unexpectedly large is streamed straight through, never buffered
    // in memory or cached — protects the container's memory regardless of
    // what gets requested.
    if (reportedLen > HF_MAX_BUFFERABLE) {
      return { stream: upstream.body, contentType, size: reportedLen || null, uncacheable: true }
    }
    const ab = await upstream.arrayBuffer()
    const buf = Buffer.from(ab)
    if (buf.length > HF_MAX_BUFFERABLE) {
      return { buf, contentType, size: buf.length, uncacheable: true }
    }
    hfCacheEvictIfNeeded(buf.length)
    HF_CACHE.set(path, { buf, contentType, size: buf.length })
    hfCacheBytes += buf.length
    return { buf, contentType, size: buf.length }
  })()
  HF_CACHE_INFLIGHT.set(path, doFetch)

  try {
    const entry = await doFetch
    res.setHeader('Content-Type', entry.contentType)
    if (entry.size) res.setHeader('Content-Length', String(entry.size))
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('X-Cache', entry.uncacheable ? 'SKIP' : 'MISS')
    if (entry.stream) { await stream({ body: entry.stream }, res) }
    else { res.end(entry.buf) }
  } catch (e) {
    log.error('hf proxy failed', { err: e, path })
    if (!res.headersSent) res.status(e.status || 502).json({ error: 'Failed to fetch model file' })
  } finally {
    HF_CACHE_INFLIGHT.delete(path)
  }
})

// --- Image proxy: /api/img?url=<remote image> ---
router.get('/img', async (req, res) => {
  const url = req.query.url
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Missing or invalid url' })
  }
  try {
    const upstream = await fetch(url, { redirect: 'follow' })
    if (!upstream.ok || !upstream.body) {
      return res.status(upstream.status || 502).json({ error: `Upstream ${upstream.status}` })
    }
    const ct = upstream.headers.get('content-type') || 'application/octet-stream'
    if (!ct.startsWith('image/')) {
      return res.status(415).json({ error: 'Not an image' })
    }
    res.setHeader('Content-Type', ct)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.setHeader('Access-Control-Allow-Origin', '*')
    await stream(upstream, res)
  } catch (e) {
    log.error('img proxy failed', { err: e })
    if (!res.headersSent) res.status(502).json({ error: 'Failed to fetch image' })
  }
})

// --- AI enhance: Gemini 3.1 Flash via LiteLLM proxy ---
// Uses OpenAI-compatible API wrapper for Gemini image processing
// Post-processes output to guarantee 1400x1400 with 100px white padding
const LITELLM_BASE = 'https://litellm.dhhmena.com/v1'
const MODEL = 'gemini-3.1-flash-image'
const OUTPUT_SIZE = 1400
const PADDING = 100
const CONTENT_SIZE = OUTPUT_SIZE - (2 * PADDING)

// Verbatim (same wording) as the reference Python script's user_prompt — kept
// identical on purpose. An earlier, much more heavily-negated rewrite of this
// prompt was tried to fight packaging hallucination, but testing showed it
// didn't actually help and the original wording below is what the Python
// tool (which reportedly gives correct output) uses.
const AI_PROMPT = `
    Clean and enhance this product image for professional catalog-style use.

    🔴 CRITICAL - PRESERVE TEXT SHARPNESS:
    ⚠️ TEXT MUST REMAIN CRYSTAL SHARP - do not blur or soften any text
    ⚠️ TEXT CLARITY: Keep all text exactly as sharp as original
    ⚠️ DO NOT over-process - avoid softening or blurring
    ⚠️ PROTECT font edges - must stay crisp and defined
    ⚠️ Maintain original text quality while enhancing surroundings

    🔴 CRITICAL - REMOVE SHADOWS ONLY:
    ⚠️ REMOVE ALL SHADOWS - eliminate drop shadows, edge shadows
    ⚠️ REMOVE any 3D depth effects
    ⚠️ FLATTEN appearance (but keep text sharp)
    ⚠️ Ensure FLAT, CLEAN background - no shadows

    ENHANCEMENT APPROACH (MINIMAL PROCESSING):
    1. Remove shadows ONLY - be surgical, don't over-process
    2. Keep text exactly as sharp as original - NO BLURRING
    3. Background: Pure white (#FFFFFF) - flat, clean
    4. Boost color saturation gently (not aggressively)
    5. Maintain original image sharpness and clarity
    6. Preserve all fine details, text, logos - exactly as clear as original

    QUALITY REQUIREMENTS:
    - Background: PURE WHITE (#FFFFFF) - flat, no shadows
    - Product: EXACT SAME product - NO changes, NO substitutions
    - Text & Labels: MUST BE SHARP - same sharpness as original input
    - Style: Clean and flat (like professional catalogs)
    - Processing: Minimal - enhance shadows/background, not the entire image

    DO NOT:
    ❌ Blur or soften any text
    ❌ Over-process the image
    ❌ Reduce text sharpness
    ❌ Make edges fuzzy
    ❌ Lose fine details
    ❌ Soften font clarity

    DO:
    ✅ Remove shadows surgically
    ✅ Keep text razor-sharp
    ✅ Maintain original clarity
    ✅ Pure white background
    ✅ Preserve details exactly

    Focus on SHADOW REMOVAL ONLY while keeping text perfectly sharp.
    `

router.post('/ai-enhance', checkGeminiAccess, async (req, res) => {
  const { image, mime } = req.body || {}
  if (!image) return res.status(400).json({ error: 'Missing image data' })

  log.info('gemini-enhance-request', { email: req.userEmail })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    log.warn('ai-enhance: GEMINI_API_KEY not configured')
    return res.status(503).json({ error: 'AI enhancement not configured on server' })
  }

  log.info('gemini-enhance-api-key-found', { keyLength: apiKey?.length || 0, keyPrefix: apiKey?.substring(0, 5) })

  const MAX_RETRIES = 3
  let lastError = null

  try {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const dataUrl = `data:${mime || 'image/png'};base64,${image}`

        const body = {
          model: MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: AI_PROMPT },
                { type: 'image_url', image_url: { url: dataUrl } }
              ]
            }
          ]
          // No temperature/top_p override — matches the reference Python
          // script, which doesn't set them either (API defaults apply).
        }

        const r = await fetch(`${LITELLM_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(body),
          agent: httpsAgent
        })

        const j = await r.json().catch(() => ({}))

        // Log response for debugging
        log.info('gemini-api-response', { status: r.status, hasImage: !!j.choices?.[0]?.message?.images, errorMsg: j.error?.message || j.error })

        if (!r.ok) {
          const em = (j.error && (j.error.message || JSON.stringify(j.error))) || (`LiteLLM error ${r.status}`)
          lastError = em

          // Retry on 503 or 429 (transient errors)
          if ((r.status === 503 || r.status === 429) && attempt < MAX_RETRIES - 1) {
            const waitTime = Math.pow(2, attempt) * 1000 // exponential backoff
            log.warn('gemini-enhance transient error, retrying', { status: r.status, attempt: attempt + 1, waitMs: waitTime })
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }

          log.error('gemini-enhance failed', { status: r.status, error: em, model: MODEL, attempt: attempt + 1 })
          return res.status(r.status || 502).json({ error: typeof em === 'string' ? em : JSON.stringify(em) })
        }

        // Success - process response
        let imageB64 = null
        let imageMime = 'image/png'

        // Extract image from OpenAI-compatible response
        if (j.choices && j.choices[0] && j.choices[0].message) {
          const message = j.choices[0].message

          // Try images array first
          if (message.images && Array.isArray(message.images) && message.images.length > 0) {
            const img = message.images[0]
            if (img.image_url && typeof img.image_url === 'object' && img.image_url.url) {
              const url = img.image_url.url
              if (url.startsWith('data:')) {
                const match = url.match(/data:image\/(\w+);base64,(.+)/)
                if (match) {
                  imageMime = `image/${match[1]}`
                  imageB64 = match[2]
                }
              }
            } else if (img.b64_json) {
              imageB64 = img.b64_json
            } else if (img.url && img.url.startsWith('data:')) {
              const match = img.url.match(/data:image\/(\w+);base64,(.+)/)
              if (match) {
                imageMime = `image/${match[1]}`
                imageB64 = match[2]
              }
            }
          }

          // Try content as fallback
          if (!imageB64 && message.content) {
            if (typeof message.content === 'string') {
              // Try to extract base64 from text content
              const match = message.content.match(/data:image\/(\w+);base64,([A-Za-z0-9+/=]+)/)
              if (match) {
                imageMime = `image/${match[1]}`
                imageB64 = match[2]
              }
            } else if (Array.isArray(message.content)) {
              for (const part of message.content) {
                if (part.type === 'image_url' && part.image_url && part.image_url.url) {
                  const url = part.image_url.url
                  if (url.startsWith('data:')) {
                    const match = url.match(/data:image\/(\w+);base64,(.+)/)
                    if (match) {
                      imageMime = `image/${match[1]}`
                      imageB64 = match[2]
                      break
                    }
                  }
                }
              }
            }
          }
        }

        if (!imageB64) {
          log.error('gemini-enhance: no image in response', { message: j.choices?.[0]?.message })
          return res.status(502).json({ error: 'Model did not return an image. Try again.' })
        }

        return res.json({ image: imageB64, mime: imageMime })
      } catch (attemptError) {
        lastError = attemptError
        if (attempt === MAX_RETRIES - 1) throw attemptError
        // Otherwise continue to next retry
      }
    }
  } catch (e) {
    log.error('ai-enhance failed', { err: e.message, stack: e.stack })
    if (!res.headersSent) {
      const errorMsg = e.message || 'Unknown error occurred'
      res.status(502).json({ error: 'Gemini API error: ' + errorMsg })
    }
  }
})

export default router
