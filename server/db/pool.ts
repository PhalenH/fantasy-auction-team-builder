// The single Postgres connection pool for every server-side script and for
// the Express API. Connection details come from DATABASE_URL in .env —
// loaded via server/loadEnv.ts (imported first in each db:* entry script, so
// it runs before this module reads process.env below) for the db:migrate/
// db:seed/db:seed:config/db:ingest scripts, or via node's --env-file flag
// for dev:server — never hardcoded, since .env is gitignored. In production
// (Railway), DATABASE_URL is injected directly and no .env file exists at
// all; both loading mechanisms leave process.env untouched when that's the
// case, so this file doesn't need to know which one is in play.

import pg from 'pg'

// Fail a request that can't get a connection rather than letting it hang
// forever when the database is unreachable.
const CONNECTION_TIMEOUT_MS = 5_000

export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: CONNECTION_TIMEOUT_MS })

  // Without this listener, an error on an IDLE client (database restarted,
  // connection dropped) is emitted as an unhandled 'error' event, which
  // terminates the process. pg discards the broken client and reconnects on
  // the next query, so logging is the correct response.
  pool.on('error', (error: Error) => {
    console.error(`Postgres idle client error (the pool will reconnect): ${error.message}`)
  })

  return pool
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Ensure .env exists at the repo root and run ' +
      'this via an npm script (npm run db:migrate / db:seed / db:seed:config / ' +
      'db:ingest / dev:server), or set DATABASE_URL directly in the environment ' +
      '(e.g. Railway).',
  )
}

export const pool = createPool(connectionString)
