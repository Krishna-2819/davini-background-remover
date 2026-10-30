// --- SECRET LOADING (DO NOT EDIT) ---
// Loads secrets from HashiCorp Vault at startup.
// Managed by the platform — do not modify this file.

import { log } from './logger.js'

const PROTECTED_ENV_KEYS = new Set([
  'PORT', 'NODE_ENV', 'PATH', 'HOME',
  'VAULT_ADDR', 'VAULT_ROLE_ID', 'VAULT_SECRET_ID', 'VAULT_MOUNT', 'APP_ID',
])
const VAULT_TIMEOUT_MS = 5000

export async function loadSecrets() {
  const { VAULT_ADDR = 'https://vaults.lths.ai', VAULT_ROLE_ID, VAULT_SECRET_ID, VAULT_MOUNT = 'kv', APP_ID } = process.env
  if (!VAULT_ROLE_ID || !VAULT_SECRET_ID || !APP_ID) {
    log.info('Vault not configured (missing VAULT_ROLE_ID, VAULT_SECRET_ID, or APP_ID) — skipping secrets')
    return
  }

  try {
    log.info(`Vault: authenticating to ${VAULT_ADDR} for app ${APP_ID}`)
    const loginRes = await fetch(`${VAULT_ADDR}/v1/auth/approle/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: VAULT_ROLE_ID, secret_id: VAULT_SECRET_ID }),
      signal: AbortSignal.timeout(VAULT_TIMEOUT_MS),
    })
    if (!loginRes.ok) {
      const body = await loginRes.text().catch(() => '')
      log.error('Vault: login failed', { status: loginRes.status, body })
      return
    }
    const vaultToken = (await loginRes.json()).auth?.client_token
    if (!vaultToken) {
      log.error('Vault: login response contained no client_token')
      return
    }
    log.info('Vault: authenticated successfully')

    const secretPath = `${VAULT_MOUNT}/data/apps/${APP_ID}`
    log.info(`Vault: reading secrets from ${secretPath}`)
    const secretRes = await fetch(`${VAULT_ADDR}/v1/${secretPath}`, {
      headers: { 'X-Vault-Token': vaultToken },
      signal: AbortSignal.timeout(VAULT_TIMEOUT_MS),
    })
    if (secretRes.status === 404) {
      log.info(`Vault: no secrets found at ${secretPath}`)
      return
    }
    if (!secretRes.ok) {
      const body = await secretRes.text().catch(() => '')
      log.error('Vault: failed to read secrets', { status: secretRes.status, body })
      return
    }

    const secrets = (await secretRes.json()).data?.data
    if (secrets && typeof secrets === 'object') {
      const keys = Object.keys(secrets)
      let loaded = 0
      const skipped = []
      for (const [key, value] of Object.entries(secrets)) {
        if (PROTECTED_ENV_KEYS.has(key)) {
          skipped.push(key)
          continue
        }
        process.env[key] = String(value)
        loaded++
      }
      log.info(`Vault: loaded ${loaded} secret(s): ${keys.filter(k => !PROTECTED_ENV_KEYS.has(k)).join(', ')}`)
      if (skipped.length) {
        log.warn(`Vault: skipped ${skipped.length} protected key(s): ${skipped.join(', ')}`)
      }
    } else {
      log.warn('Vault: secret response had no data')
    }
  } catch (e) {
    log.error('Vault: failed to load secrets', { err: e })
  }
}
