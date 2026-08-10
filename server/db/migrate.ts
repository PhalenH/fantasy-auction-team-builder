// Minimal SQL migration runner — stands in for a migration library.
//
// Applies every server/migrations/*.sql file not yet recorded in the
// schema_migrations ledger, in lexical filename order, each inside its own
// transaction so a failed migration leaves no partial schema behind.
// Rerunning is a no-op. That is the whole feature set this project needs
// from a migration tool, hence no dependency (CLAUDE.md: do not introduce
// unnecessary dependencies).

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { pool } from './pool'

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

async function migrate(): Promise<void> {
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    const { rows } = await client.query<{ filename: string }>('SELECT filename FROM schema_migrations')
    const applied = new Set(rows.map((row) => row.filename))

    const pending = readdirSync(MIGRATIONS_DIR)
      .filter((filename) => filename.endsWith('.sql'))
      .sort()
      .filter((filename) => !applied.has(filename))

    if (pending.length === 0) {
      console.log('No pending migrations — schema is up to date.')
      return
    }

    for (const filename of pending) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${filename} failed and was rolled back: ${(error as Error).message}`)
      }

      console.log(`Applied ${filename}`)
    }

    console.log(`Done — ${pending.length} migration(s) applied.`)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((error: unknown) => {
  console.error((error as Error).message)
  process.exitCode = 1
})
