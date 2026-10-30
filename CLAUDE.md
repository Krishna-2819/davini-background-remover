# Background Remover

> **All files for this app are at `C:\Users\KrishnaKishoreSabbi\.vibehost\apps\bg-remover`.** Always use absolute paths (e.g. `C:\Users\KrishnaKishoreSabbi\.vibehost\apps\bg-remover/src/App.jsx`) when reading or writing files

## Before You Build — Brainstorm With the User

Before writing any code, have a short conversation with the user to understand what they want. Do NOT start building from a vague one-liner like "make me a portfolio"

1. **Feature scoping**: Ask "What are the 3-5 key things users should be able to do or see?" If the user is unsure, suggest concrete options based on their idea and ask them to pick or refine
2. **Design direction**: Ask about style preferences — dark/light, minimal/bold, color palette, or a reference site they like. If they have no preference, offer 2-3 quick options to choose from
3. **Don't Overengineer**: Write simple, readable and maintainable code

Once you have clear answers, summarize the plan back to the user in a few bullet points and get confirmation before writing code.

## Project Structure
- `src/` — React frontend
  - `src/App.jsx` — Main app component. Do not put all components here; create new components in `src/components/`
  - `src/components/` — Create new components here (e.g. `src/components/UserCard.jsx`)
  - `src/components/Layout.jsx` — Page layout wrapper
  - `src/index.css` — Global styles and Tailwind imports
  - `src/main.jsx` — React entry point
- `server/index.js` — Express backend (import and mount route files here)
- `server/routes/` — API route files (e.g. `server/routes/health.js`, `server/routes/users.js`)
- `server/secrets.js` — Vault secret loader (read-only, managed by the platform)
- `server/database.js` — MySQL database connection (read-only, managed by the platform)
- `server/logger.js` — Logger (read-only, managed by the platform)
- `public/` — Static assets (images, fonts, etc.)
- `index.html` — HTML entry point

## Guidelines
- Build the frontend in `src/` using React components — put new components in `src/components/`
- If the app needs API endpoints or server-side logic, create route files in `server/routes/` and mount them in `server/index.js` (see Routing section below)
- If the app does NOT need a backend, just build in `src/` and ignore the `server/` directory
- You may install npm packages — add them to `package.json` and they will be installed during build
- Use the existing Express server structure — do not create a new server framework or rewrite the server setup
- The user is a non-engineer founder with a clear vision but no coding experience, so:
    - The user's machine might not have a complete development environment set up, so the app should run with minimal setup
    - If there are issues with npm packages or build tools, remember that the build and deployment is on different infrastructure than your local environment
        - For example if you face SSL errors with npm packages, that won't be a problem in the build and deployed environment
        - If you need to install new npm packages, just add them to the relevant package.json and they will be installed during build
    - Be clear about the issues to the user if you encounter problems that are specific to your local environment and won't affect the deployed app
- Read the Dockerfile to understand the environment and constraints before building


## Security
- **NEVER hardcode sensitive information**, use the secrets management system instead (see Secrets section below)
- Do not modify the Dockerfile or deployment configurations

## Routing
Create a separate file in `server/routes/` for each resource, export an `express.Router()`, and mount it in `server/index.js`. See `server/routes/health.js` for the pattern.

**To add a new route file** (e.g. users):

1. Create `server/routes/users.js`:
```js
import { Router } from 'express'
import { requireDb } from '../database.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const db = requireDb()
    const [rows] = await db.query('SELECT * FROM users')
    res.json({ data: rows })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message })
  }
})

export default router
```

2. Mount it in `server/index.js`:
```js
import usersRouter from './routes/users.js'
app.use('/api/users', usersRouter)
```

**Rules:**
- One file per resource (users.js, posts.js, etc.) — do NOT put all routes in `server/index.js`
- Always wrap async route handlers in try/catch
- Return consistent response shapes: `{ data: ... }` for success, `{ error: '...' }` for errors
- **All backend endpoints must be under `/api/*`** — including server-only ones that have no React page, like OAuth callbacks or webhooks (use `/api/auth/callback`, `/api/webhooks/stripe`, etc.). `server/index.js` serves the React app for every non-`/api` path, so anything mounted elsewhere returns the HTML page instead of running your handler — a request to it comes back as `<!DOCTYPE html>...`, not your response. When registering a redirect/callback URL with a third party, give them the `/api/...` URL.
- **Mount routers above the `--- STATIC SERVING ---` block in `server/index.js`.** Anything mounted below it is shadowed by the catch-all and never runs. Do not edit the static-serving block itself.

## Styling
Tailwind CSS is pre-configured — use utility classes directly in JSX. No setup needed.

```jsx
<div className="flex items-center gap-4 p-6 bg-white rounded-lg shadow">
  <h2 className="text-xl font-semibold text-gray-900">Title</h2>
</div>
```

- Add custom styles or Tailwind extensions in `src/index.css`
- The Inter font is loaded in `index.html` — use it via `font-[Inter,sans-serif]` or set it as your default in `src/index.css`
- **Do NOT install other CSS frameworks** (Material UI, Ant Design, Chakra, styled-components) — use Tailwind utilities

## Secrets
Never hardcode sensitive values (API keys, passwords, PINs, database credentials) in source code.
The platform injects secrets as environment variables at runtime — access them via process.env.SECRET_NAME in server code.

When you identify a secret or sensitive value during development, follow this process:
1. Immediately call `add_secret` with the domain, name, and value
    a. do NOT ask the user how to handle it, do NOT explain what secrets are, and do NOT offer options
    b. Just store it silently and confirm in plain language (e.g. "Account created" or "Credentials saved")
2. In server code, reference it via `process.env.SECRET_NAME` — secrets are injected at runtime
3. At deploy time, secrets are included automatically — no extra steps needed
4. Always validate credentials server-side. Never hardcode them in client-side code

- Secrets load best-effort at startup — a missing or failed secret does **not** crash the app; `process.env.SECRET_NAME` is simply `undefined`. Handle that case in server code (validate and return a clear error) rather than assuming a secret is always present.
- Do **not** name a secret `PORT`, `NODE_ENV`, `PATH`, `HOME`, `APP_ID`, or anything starting with `VAULT_` — the platform reserves these and will silently skip them.

**Do NOT modify `server/secrets.js` or add dotenv/other secret-loading code. Secrets are handled by the platform.**

## Logging
In server code, use the logger instead of `console.*` — it writes one JSON line per event so logs stay readable in our log system (a raw multi-line stack trace gets split into many broken entries).

```js
import { log } from './logger.js'

log.info('user created', { id: user.id })
log.warn('cache miss', { key })

// In a catch block, pass the caught error as `err` — never console.log a stack trace:
catch (e) {
  log.error('failed to load users', { err: e })
  res.status(500).json({ error: 'Internal error' })
}
```

**Do NOT modify `server/logger.js`. Do NOT add winston, pino, or other logging libraries — use `log` from `logger.js`.**

## Database
Your app has a MySQL database managed through two MCP tools: `execute_sql` (run SQL statements) and `describe_database` (inspect current schema).

If the user describes any feature where data is created, collected, or listed, use the database — don't ask the user whether or where to store data.

**To create or modify tables**, call `execute_sql` — do NOT write CREATE TABLE or ALTER TABLE statements in server code. Examples:
- `execute_sql(domain, "CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255) UNIQUE)")`
- `execute_sql(domain, "ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")`

**To see current tables**, use the `describe_database` MCP tool before making schema changes.

**In route files**, use `requireDb()` and always follow this pattern:
```js
import { Router } from 'express'
import { requireDb } from '../database.js'

const router = Router()

router.get('/:id', async (req, res) => {
  try {
    const db = requireDb()
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id])
    res.json({ data: rows })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message })
  }
})

export default router
```

**Rules:**
- Always use `?` placeholders for variables — **never** use template literals or string concatenation in SQL
- Always wrap database calls in try/catch
- Use `requireDb()` (not `getDb()`) — it throws a clean 503 if the database is unavailable
- When you add or change a query, make sure the table actually has those columns — use `describe_database` to check before deploying.
- The database connection is established best-effort at startup; if it's unavailable, `requireDb()` throws a 503 (this is why your try/catch matters). Don't assume the pool is always ready.

The database is automatically provisioned on deploy. Schema changes made via `execute_sql` persist across deploys.

**Do NOT modify `server/database.js`. Do NOT add knex, prisma, sequelize, or other ORMs — use `mysql2` via `requireDb()` directly.**

## Limitations
If the user asks for any of the following, STOP and explain the limitation.

Do NOT attempt to work around it by modifying the Dockerfile, adding Docker services, or creating docker-compose files.

- **Writing to the local filesystem (file uploads, generated files)**: The container has no persistent disk — any file written at runtime is lost on the next deploy, and with multiple/replaced containers there is no shared disk to read it back from. Do NOT build features that save files to disk. For data that must persist, use the database instead (see the Database section) — database data DOES persist across deploys.

Note: persisting DATA is fully supported via the MySQL database. The limitation above is specifically about the filesystem, not about storing data. Do not tell the user the platform "can't store data."

Tell the user: "This platform doesn't support [feature] yet."

## Editable Files
You may edit: src/**, server/**, server/routes/**, index.html, public/**

## Read-Only Files
Do NOT modify: Dockerfile, vite.config.js, vibefest.json, server/secrets.js, server/database.js, server/logger.js

## Pre-Deploy Checklist (MANDATORY)

Before calling `deploy_app`, you MUST verify all of the following. Fix any issues before deploying.

1. **All imports resolve to existing files** — no importing files that don't exist
2. **All dependencies are in package.json** — every third-party import must have a matching entry
3. **Code builds with the existing Dockerfile** — read the Dockerfile; don't rely on tools or steps it doesn't have
4. **All referenced assets exist** — images, fonts, etc. must be in `public/` or be valid URLs
5. **Server entry point is intact** — `server/index.js` must exist and work as expected
6. **All secrets are stored** — if any code references `process.env.SECRET_NAME`, verify it has been added with `add_secret` and is present in `secrets.json`
7. **Database tables exist** — if the app uses `requireDb()`, verify tables have been created via `describe_database` before deploying
8. Basically ensure the **App is in a working condition** to be deployed without errors

## Deployment
NEVER deploy automatically. Only call `deploy_app` when the user EXPLICITLY asks to deploy (e.g. "deploy", "push it live", "ship it").
Do NOT deploy after scaffolding, building features, or finishing work — wait for the user to ask.
