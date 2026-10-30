// --- LOGGING (DO NOT EDIT) ---
// Managed by the platform — do not modify this file.
//
// Emits ONE line of JSON per log event so Grafana Loki ingests each event as a
// single entry (a multi-line stack trace would otherwise become many entries).
//
// Usage in server code:
//   import { log } from './logger.js'
//   log.info('user created', { id: 42 })
//   log.warn('cache miss', { key })
//   log.error('failed to load users', { err })   // pass the caught Error as `err`

function flatten(value) {
  // Collapse an Error (message + stack) into a single-line string.
  if (value instanceof Error) {
    return `${value.message} | ${(value.stack || '').replace(/\n\s*/g, ' | ')}`
  }
  return value
}

function emit(level, msg, fields = {}) {
  const entry = { time: new Date().toISOString(), level, msg, ...fields }
  const line = JSON.stringify(entry, (_key, value) => flatten(value))
  const stream = level === 'error' ? process.stderr : process.stdout
  stream.write(line + '\n')
}

export const log = {
  info: (msg, fields) => emit('info', msg, fields),
  warn: (msg, fields) => emit('warn', msg, fields),
  error: (msg, fields) => emit('error', msg, fields),
}
