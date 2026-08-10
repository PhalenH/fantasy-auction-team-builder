// The single Postgres connection pool for every server-side script and,
// later, the Express API. Connection details come from DATABASE_URL in .env
// (loaded via node's built-in --env-file flag, see package.json's db:*
// scripts) — never hardcoded, since .env is gitignored.

import pg from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Ensure .env exists at the repo root and run ' +
      'this via an npm script (npm run db:migrate / db:seed), which passes ' +
      '--env-file=.env to node.',
  )
}

export const pool = new pg.Pool({ connectionString })
