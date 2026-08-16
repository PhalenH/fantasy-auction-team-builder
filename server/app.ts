// Builds the Express app. Deliberately does NOT listen — server/index.ts
// owns the port binding, so tests can exercise the app over an ephemeral
// port without racing for the real one.
//
// STATELESSNESS (CLAUDE.md, Session Isolation): this app holds no
// module-level mutable state and no cache. Every response is a pure function
// of current database contents. Draft progress — drafted/favorited status,
// roster assignments, budget — lives only in React state and never reaches
// this server, so there is nothing here to leak between users or tabs.
//
// It is also read-only: only GET routes are registered, and no body parser
// is mounted (there is no request body to read, and its absence is a
// structural reminder that this server accepts no writes).
//
// PRODUCTION TOPOLOGY: this also serves the built frontend (npm run build's
// dist/ output) alongside /api/*, so the whole app is one process/service in
// production (e.g. one Railway service) rather than two that have to be
// deployed and pointed at each other separately. Dev is unaffected — Vite's
// own dev server + proxy (vite.config.ts) handles that locally, and never
// touches this file.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import type { Pool } from 'pg'

import { createLeagueFormatsRouter } from './routes/leagueFormats'
import { createPlayersRouter } from './routes/players'
import { createTeamsRouter } from './routes/teams'

// Errors that mean "the database isn't reachable" rather than "the query was
// wrong" — Node socket-level codes plus the Postgres connection SQLSTATEs.
const DB_UNREACHABLE_CODES = new Set([
  'ECONNREFUSED', // nothing listening (container down)
  'ENOTFOUND', // host doesn't resolve
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ECONNRESET',
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08006', // connection_failure
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now (e.g. still starting up)
  '53300', // too_many_connections
])

// Not every connection failure carries a code. When the database goes away
// while a pooled connection is already open, pg throws a plain Error whose
// only signal is its message — verified by stopping the container against a
// running server, which produced "Connection terminated unexpectedly" with
// no code and would otherwise be misreported as a 500.
const DB_UNREACHABLE_MESSAGES = [
  /timeout exceeded when trying to connect/i,
  /connection terminated/i,
  /connection ended unexpectedly/i,
  /client has encountered a connection error/i,
  /server closed the connection unexpectedly/i,
  /connect ECONNREFUSED/i,
]

export function isDatabaseUnreachable(error: Error): boolean {
  const code = (error as NodeJS.ErrnoException).code
  if (code && DB_UNREACHABLE_CODES.has(code)) return true
  return DB_UNREACHABLE_MESSAGES.some((pattern) => pattern.test(error.message))
}

// The complete API surface, as data. createApp mounts exactly these and
// nothing else, so this doubles as the list the statelessness test walks —
// Express 5 doesn't retain a static mount path on its router layers, so
// there's nowhere else to read the full paths back from.
export const API_MOUNTS = [
  { path: '/api/players', createRouter: createPlayersRouter },
  { path: '/api/league-formats', createRouter: createLeagueFormatsRouter },
  { path: '/api/teams', createRouter: createTeamsRouter },
] as const

// Resolved relative to this file (not process.cwd()) so it's correct no
// matter where `npm start`/`tsx server/index.ts` is invoked from. `dist/` is
// npm run build's output — see vite.config.ts; nothing here builds it.
const DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')

export function createApp(db: Pool): Express {
  const app = express()

  app.disable('x-powered-by')

  // Serves the built frontend's real files (JS/CSS bundles, favicon,
  // index.html for GET /). A plain middleware function, not a route/router —
  // app.test.ts's route-enumeration test only walks layers with a `.route`
  // or a sub-router's `.handle.stack`, so this stays invisible to it, same
  // as the SPA fallback below. Calls next() for any path with no matching
  // file (including every /api/* request, and simply when dist/ doesn't
  // exist yet, e.g. a test run or a dev checkout that hasn't been built) —
  // it never throws for a missing file or a missing dist/ directory.
  app.use(express.static(DIST_DIR))

  for (const mount of API_MOUNTS) {
    app.use(mount.path, mount.createRouter(db))
  }

  // SPA fallback: any GET that isn't under /api/* and didn't match a real
  // file above gets index.html, so a direct load or refresh of a
  // client-side route (today: none, but this makes it correct if one is
  // ever added) still resolves instead of 404ing. Registered after
  // API_MOUNTS and gated on the /api/ prefix so a mistyped or missing
  // /api/* path still falls through to the JSON 404 below rather than
  // getting an HTML page back.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) {
      next()
      return
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })

  // JSON 404 rather than Express's default HTML page, so a mistyped path
  // (or an attempted write to a real path) reads sensibly to a fetch caller.
  // In practice now only reached by a non-GET request to an unknown path or
  // an unmatched /api/* path, since the SPA fallback above claims every
  // other GET.
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'not_found',
      message: `No route for ${req.method} ${req.originalUrl}. This API is read-only and serves GET /api/players, GET /api/league-formats, and GET /api/teams.`,
    })
  })

  // Mounted last. `_next` is unused but required — Express identifies error
  // middleware by its four-parameter signature.
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (isDatabaseUnreachable(error)) {
      // Fall back to the message, not a fixed label: codeless failures have
      // distinct causes ("Connection terminated unexpectedly" vs a genuine
      // connect timeout) and reporting the wrong one sends you debugging in
      // the wrong direction.
      const cause = (error as NodeJS.ErrnoException).code ?? error.message
      res.status(503).json({
        error: 'database_unavailable',
        message: `Cannot reach the database (${cause}). Is the Postgres container running? Try: docker compose up -d`,
      })
      return
    }

    console.error('Unhandled error serving request:', error)
    res.status(500).json({ error: 'internal_error', message: error.message })
  })

  return app
}
