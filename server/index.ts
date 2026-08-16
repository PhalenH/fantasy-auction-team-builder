// Bootstrap only — builds the app around the shared pool and binds the port.
// All wiring lives in app.ts so tests can skip this file entirely.

import { createApp } from './app'
import { pool } from './db/pool'

// PORT takes priority: hosting platforms (e.g. Railway) assign it
// dynamically and route traffic to whatever it is, so the app must bind to
// it when present. Locally PORT is unset, so this falls back to API_PORT —
// 3001 avoids Vite's dev server (5173) and the Postgres container (5434).
// The Vite dev proxy reads that same API_PORT from .env, so the two stay in
// sync from one source (see vite.config.ts).
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001)

createApp(pool).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
  console.log('  GET /api/players')
  console.log('  GET /api/league-formats')
  console.log('  GET /api/teams')
})
