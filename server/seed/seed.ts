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
// Rerunnable: truncates and reinserts inside a single transaction. That is
// safe precisely because of CLAUDE.md's Session Isolation rule — no
// user-owned or session state is stored server-side, so every row in these
// tables is wholly derived from the files above and fully disposable. Real
// ingestion will upsert on espn_player_id/yahoo_player_id instead.

import type { PoolClient } from 'pg'

import { leagueFormats, rosterPositionSlots } from '../../src/data/leagueFormats'
import { players, playerValuations } from '../../src/data/mockPlayers'
import { pool } from '../db/pool'
import { positions, teams, valuationSources } from './lookups'

// Child-before-parent order; CASCADE covers the FKs either way, but being
// explicit keeps the intent readable.
const DATA_TABLES = [
  'player_valuation',
  'player',
  'team',
  'roster_slot_eligible_position',
  'roster_position_slot',
  'league_format',
  'valuation_source',
  'position',
]

// Fail with a pointed message rather than a raw FK violation when the mock
// data references something the lookup tables don't define.
function validate(): void {
  const positionCodes = new Set<string>(positions.map((position) => position.code))
  const sourceCodes = new Set<string>(valuationSources.map((source) => source.code))
  const teamCodes = new Set<string>(teams.map((team) => team.code))
  const formatIds = new Set(leagueFormats.map((format) => format.id))
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

async function seed(client: PoolClient): Promise<Record<string, number>> {
  await client.query(`TRUNCATE TABLE ${DATA_TABLES.join(', ')} RESTART IDENTITY CASCADE`)

  for (const position of positions) {
    await client.query('INSERT INTO position (code, display_name) VALUES ($1, $2)', [
      position.code,
      position.displayName,
    ])
  }

  for (const source of valuationSources) {
    await client.query('INSERT INTO valuation_source (code, display_name) VALUES ($1, $2)', [
      source.code,
      source.displayName,
    ])
  }

  for (const team of teams) {
    await client.query('INSERT INTO team (code, display_name, bye_week) VALUES ($1, $2, $3)', [
      team.code,
      team.displayName,
      team.byeWeek,
    ])
  }

  // The mock files' string ids ('regular', 'p1') are only a local join key —
  // these maps translate them to the database's generated ids.
  const formatIdByKey = new Map<string, number>()
  for (const format of leagueFormats) {
    const { rows } = await client.query<{ id: number }>(
      'INSERT INTO league_format (key, display_name) VALUES ($1, $2) RETURNING id',
      [format.key, format.displayName],
    )
    formatIdByKey.set(format.id, rows[0].id)
  }

  let eligibleRowCount = 0
  for (const slot of rosterPositionSlots) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO roster_position_slot (league_format_id, slot_label, count, sort_order, toggle_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [formatIdByKey.get(slot.leagueFormatId), slot.slotLabel, slot.count, slot.sortOrder, slot.toggleKey],
    )

    for (const code of slot.eligiblePositions) {
      await client.query(
        'INSERT INTO roster_slot_eligible_position (roster_position_slot_id, position_code) VALUES ($1, $2)',
        [rows[0].id, code],
      )
      eligibleRowCount += 1
    }
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

  // Returned rather than printed here: reporting happens after COMMIT, so
  // the summary always describes committed state (and a failure to write to
  // stdout can never roll back an otherwise-good seed).
  return {
    position: positions.length,
    valuation_source: valuationSources.length,
    team: teams.length,
    league_format: leagueFormats.length,
    roster_position_slot: rosterPositionSlots.length,
    roster_slot_eligible_position: eligibleRowCount,
    player: players.length,
    player_valuation: playerValuations.length,
  }
}

async function run(): Promise<void> {
  validate()

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

run().catch((error: unknown) => {
  console.error(`Seed failed (no changes committed): ${(error as Error).message}`)
  process.exitCode = 1
})
