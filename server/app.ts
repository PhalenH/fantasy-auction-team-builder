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

export function createApp(db: Pool): Express {
  const app = express()

  app.disable('x-powered-by')

  for (const mount of API_MOUNTS) {
    app.use(mount.path, mount.createRouter(db))
  }

  // JSON 404 rather than Express's default HTML page, so a mistyped path
  // (or an attempted write to a real path) reads sensibly to a fetch caller.
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
