// Standalone entry point for the reference/config-only seed path — see
// seedLookupsAndConfig in ./seed.ts for what it actually inserts (position,
// valuation_source, league_format, roster_position_slot,
// roster_slot_eligible_position) and why it's safe to run against a
// database that already has real ingested player data sitting on top of
// these tables: no TRUNCATE, only ON CONFLICT-guarded inserts on each
// table's natural key.
//
// This exists because real ingestion (server/ingestion/run.ts) assumes
// position/valuation_source/league_format/roster_position_slot/
// roster_slot_eligible_position are already populated — it only upserts
// team/player/player_valuation, and fails on a foreign-key violation
// otherwise. A freshly migrated database (schema only, no rows) has none of
// that reference data yet, and the full db:seed script isn't appropriate
// there since it also seeds mock players that would need cleaning up. This
// script is the narrow alternative: reference/config data only, nothing
// player-shaped.
//
// Usage: node --env-file=.env --import tsx server/seed/seedConfig.ts

import { pool } from '../db/pool'
import { seedLookupsAndConfig } from './seed'

async function run(): Promise<void> {
  const client = await pool.connect()
  let counts: Record<string, number>
  try {
    await client.query('BEGIN')
    try {
      counts = await seedLookupsAndConfig(client)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  } finally {
    client.release()
    await pool.end()
  }

  const width = Math.max(...Object.keys(counts).map((table) => table.length))
  console.log('Seeded (config only):')
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(width)}  ${count}`)
  }
}

run().catch((error: unknown) => {
  console.error(`Config seed failed (no changes committed): ${(error as Error).message}`)
  process.exitCode = 1
})
