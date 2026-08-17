// Seeds the reference tables from the EXISTING FRONTEND DATA — src/data/
// mockPlayers.ts and src/data/leagueFormats.ts are imported directly rather
// than duplicated as hand-authored SQL, so there is one source of truth and
// the database cannot drift from what the frontend has been tested against.
//
// This server -> src/data import is deliberate, dev-time only, and
// one-directional: nothing under src/ ever imports from server/. It goes
// away entirely when real ESPN/Yahoo ingestion replaces the mock layer,
// writing into these same tables (docs/datamodel.md, "Swap-in path").
//
// Split into two composable pieces:
//   - seedLookupsAndConfig(): position/valuation_source/league_format/
//     roster_position_slot/roster_slot_eligible_position. No player or
//     player_valuation statements — this is server-authoritative reference
//     data the app can't run without, independent of which player-data path
//     (this file's mock players vs. server/ingestion/'s real upserts)
//     populates the player-facing tables. Never truncates: only
//     ON CONFLICT-guarded inserts on each table's natural key, so it's safe
//     to run standalone (server/seed/seedConfig.ts, npm run db:seed:config)
//     against a database that already has real ingested player data sitting
//     on top of these tables, and safely re-runnable later (e.g. a new
//     format added to leagueFormats.ts) rather than a run-exactly-once step.
//   - seedMockPlayers(): team/player/player_valuation from mockPlayers.ts.
//     Unchanged truncate-and-reinsert dev-fallback logic.
// npm run db:seed (this file's own run() below) still calls both, in the
// same order, inside one transaction — identical end state to before the
// split. It also truncates the config tables itself first (a step neither
// piece owns alone) so a full db:seed still resets everything on every run,
// exactly as it always has.
//
// Safe to truncate-and-reinsert at all (both here and in the mock-only
// piece) precisely because of CLAUDE.md's Session Isolation rule — no
// user-owned or session state is stored server-side, so every row in these
// tables is wholly derived from the files above and fully disposable.

import { fileURLToPath } from 'node:url'

import type { PoolClient } from 'pg'

import { leagueFormats, rosterPositionSlots } from '../../src/data/leagueFormats'
import { players, playerValuations } from '../../src/data/mockPlayers'
import { pool } from '../db/pool'
import { positions, teams, valuationSources } from './lookups'

// Child-before-parent order; CASCADE covers the FKs either way, but being
// explicit keeps the intent readable. Truncating `position` alone would
// already cascade into `player`/`player_valuation` via their FKs even
// without team/player/player_valuation listed here — seedMockPlayers'
// own truncate below is what actually owns repopulating those, this list
// only needs to cover the config tables seedLookupsAndConfig doesn't
// truncate itself.
const CONFIG_TABLES = [
  'roster_slot_eligible_position',
  'roster_position_slot',
  'league_format',
  'valuation_source',
  'position',
]

// Fail with a pointed message rather than a raw FK/lookup mismatch when
// leagueFormats.ts references a position lookups.ts doesn't define.
function validateLookupsAndConfig(): void {
  const positionCodes = new Set<string>(positions.map((position) => position.code))
  const formatIds = new Set(leagueFormats.map((format) => format.id))

  for (const slot of rosterPositionSlots) {
    if (!formatIds.has(slot.leagueFormatId)) {
      throw new Error(
        `Roster slot "${slot.id}" references league format "${slot.leagueFormatId}", which is not in leagueFormats.`,
      )
    }
    for (const code of slot.eligiblePositions) {
      if (!positionCodes.has(code)) {
        throw new Error(
          `Roster slot "${slot.id}" lists eligible position "${code}", which is not defined in seed/lookups.ts.`,
        )
      }
    }
  }
}

// Same idea, scoped to what seedMockPlayers actually inserts.
function validateMockPlayers(): void {
  const positionCodes = new Set<string>(positions.map((position) => position.code))
  const sourceCodes = new Set<string>(valuationSources.map((source) => source.code))
  const teamCodes = new Set<string>(teams.map((team) => team.code))
  const playerIds = new Set(players.map((player) => player.id))

  for (const player of players) {
    if (!positionCodes.has(player.position)) {
      throw new Error(
        `Player "${player.name}" has position "${player.position}", which is not defined in seed/lookups.ts.`,
      )
    }
    if (!teamCodes.has(player.teamCode)) {
      throw new Error(
        `Player "${player.name}" has team "${player.teamCode}", which is not defined in seed/lookups.ts.`,
      )
    }
  }

  for (const valuation of playerValuations) {
    if (!playerIds.has(valuation.playerId)) {
      throw new Error(`Valuation "${valuation.id}" references player "${valuation.playerId}", which does not exist.`)
    }
    if (!sourceCodes.has(valuation.source)) {
      throw new Error(
        `Valuation "${valuation.id}" has source "${valuation.source}", which is not defined in seed/lookups.ts.`,
      )
    }
  }
}

// Reference/config tables only. See the file header for why this never
// truncates: ON CONFLICT on each table's natural key makes it a pure
// upsert, safe to call standalone and safe to rerun.
export async function seedLookupsAndConfig(client: PoolClient): Promise<Record<string, number>> {
  validateLookupsAndConfig()

  for (const position of positions) {
    await client.query('INSERT INTO position (code, display_name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING', [
      position.code,
      position.displayName,
    ])
  }

  for (const source of valuationSources) {
    await client.query(
      'INSERT INTO valuation_source (code, display_name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING',
      [source.code, source.displayName],
    )
  }

  // DO UPDATE (not DO NOTHING) here and on roster_position_slot below,
  // specifically because the generated `id` is needed afterward to wire up
  // league_format_id/roster_position_slot_id on their children — ON
  // CONFLICT DO NOTHING returns no row at all when the conflict fires,
  // which would leave nothing to wire up on a rerun. DO UPDATE always
  // returns the row via RETURNING, whether it just inserted or already
  // existed, and keeps display_name in sync with the source as a bonus.
  const formatIdByKey = new Map<string, number>()
  for (const format of leagueFormats) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO league_format (key, display_name)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id`,
      [format.key, format.displayName],
    )
    // The mock files' string ids ('regular') are only a local join key —
    // this map translates them to the database's generated ids.
    formatIdByKey.set(format.id, rows[0].id)
  }

  let eligibleRowCount = 0
  for (const slot of rosterPositionSlots) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO roster_position_slot (league_format_id, slot_label, count, sort_order, toggle_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (league_format_id, slot_label) DO UPDATE SET
         count = EXCLUDED.count, sort_order = EXCLUDED.sort_order, toggle_key = EXCLUDED.toggle_key
       RETURNING id`,
      [formatIdByKey.get(slot.leagueFormatId), slot.slotLabel, slot.count, slot.sortOrder, slot.toggleKey],
    )

    for (const code of slot.eligiblePositions) {
      await client.query(
        `INSERT INTO roster_slot_eligible_position (roster_position_slot_id, position_code)
         VALUES ($1, $2)
         ON CONFLICT (roster_position_slot_id, position_code) DO NOTHING`,
        [rows[0].id, code],
      )
      eligibleRowCount += 1
    }
  }

  return {
    position: positions.length,
    valuation_source: valuationSources.length,
    league_format: leagueFormats.length,
    roster_position_slot: rosterPositionSlots.length,
    roster_slot_eligible_position: eligibleRowCount,
  }
}

// Mock player data only: team (needed for player.team_code), player, and
// player_valuation, from src/data/mockPlayers.ts. Truncate-and-reinsert,
// unchanged from before the split — real ingestion (server/ingestion/
// run.ts) upserts team itself too, so this duplicate insert is fine, both
// paths converge on the same table.
export async function seedMockPlayers(client: PoolClient): Promise<Record<string, number>> {
  validateMockPlayers()

  await client.query('TRUNCATE TABLE player_valuation, player, team RESTART IDENTITY CASCADE')

  for (const team of teams) {
    await client.query('INSERT INTO team (code, display_name, bye_week) VALUES ($1, $2, $3)', [
      team.code,
      team.displayName,
      team.byeWeek,
    ])
  }

  const playerIdByKey = new Map<string, number>()
  for (const player of players) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO player (name, team_code, position_code, espn_player_id, yahoo_player_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        player.name,
        player.teamCode,
        player.position,
        // Null under mock data — permanently unpopulated by real ingestion too.
        player.espnPlayerId ?? null,
        player.yahooPlayerId ?? null,
      ],
    )
    playerIdByKey.set(player.id, rows[0].id)
  }

  for (const valuation of playerValuations) {
    await client.query(
      `INSERT INTO player_valuation (player_id, source_code, auction_value, season_year, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        playerIdByKey.get(valuation.playerId),
        valuation.source,
        valuation.auctionValue,
        valuation.seasonYear,
        valuation.updatedAt,
      ],
    )
  }

  return {
    team: teams.length,
    player: players.length,
    player_valuation: playerValuations.length,
  }
}

async function seed(client: PoolClient): Promise<Record<string, number>> {
  // Owned here, not by either piece above: a full db:seed still resets the
  // config tables on every run, exactly as before the split.
  // seedLookupsAndConfig's ON CONFLICT clauses are no-ops on a table that's
  // already empty, so this reproduces the pre-split behavior exactly.
  await client.query(`TRUNCATE TABLE ${CONFIG_TABLES.join(', ')} RESTART IDENTITY CASCADE`)

  const configCounts = await seedLookupsAndConfig(client)
  const mockCounts = await seedMockPlayers(client)

  // Returned rather than printed here: reporting happens after COMMIT, so
  // the summary always describes committed state (and a failure to write to
  // stdout can never roll back an otherwise-good seed).
  return { ...configCounts, ...mockCounts }
}

async function run(): Promise<void> {
  const client = await pool.connect()
  let counts: Record<string, number>
  try {
    await client.query('BEGIN')
    try {
      counts = await seed(client)
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
  console.log('Seeded:')
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(width)}  ${count}`)
  }
}

// Guarded so importing seedLookupsAndConfig/seedMockPlayers from elsewhere
// (server/seed/seedConfig.ts) never triggers this full seed as a side
// effect of the import — only fires when this file is the actual entry
// point (node ... server/seed/seed.ts), not when it's merely imported.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error: unknown) => {
    console.error(`Seed failed (no changes committed): ${(error as Error).message}`)
    process.exitCode = 1
  })
}
