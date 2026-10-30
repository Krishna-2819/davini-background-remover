// --- DATABASE CONNECTION (DO NOT EDIT) ---
// Managed by the platform — do not modify this file.
//
// Usage in server/index.js:
//   import { requireDb } from './database.js'
//
//   app.get('/api/users', async (req, res) => {
//     try {
//       const db = requireDb()
//       const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id])
//       res.json({ data: rows })
//     } catch (e) {
//       res.status(e.status || 500).json({ error: e.message })
//     }
//   })
//
// IMPORTANT: Always use ? placeholders — never interpolate variables into SQL strings.

import mysql from 'mysql2/promise'
import { log } from './logger.js'

let pool = null

export async function initDatabase() {
  const { APP_ID, DB_HOST, DB_PORT = '3306', DB_PASSWORD } = process.env
  if (!DB_HOST || !APP_ID) {
    log.info('Database not configured (missing DB_HOST or APP_ID) — skipping database')
    return null
  }

  const dbName = APP_ID
  const dbUser = `app_${APP_ID}`

  try {
    log.info(`Database: connecting to ${DB_HOST}:${DB_PORT}/${dbName} as ${dbUser}`)
    pool = mysql.createPool({
      host: DB_HOST,
      port: parseInt(DB_PORT, 10),
      database: dbName,
      user: dbUser,
      password: DB_PASSWORD || '',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 50,
      connectTimeout: 10000,
    })

    const conn = await pool.getConnection()
    conn.release()
    log.info('Database: connected successfully')
    return pool
  } catch (e) {
    log.error('Database: failed to connect', { err: e })
    pool = null
    return null
  }
}

export function getDb() {
  return pool
}

export function requireDb() {
  if (!pool) throw Object.assign(new Error('Database not available'), { status: 503 })
  return pool
}
