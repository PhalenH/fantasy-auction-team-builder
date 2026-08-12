// Orchestrates real ingestion: upsert Team -> upsert Player -> upsert
// PlayerValuation (docs/datamodel.md, "Real ingestion"). Order matters —
// Team must exist before Player (player.team_code is a FK), and Player rows
// must exist before PlayerValuation (needs player_id).
//
// Unlike server/seed/seed.ts (truncate-and-reinsert), this is upsert-based:
// re-running it against an unchanged source is a no-op, and running it
// against an updated source updates existing rows in place rather than
// duplicating them. Team upserts on `code`; Player upserts on a normalized
// (name, position) match key (see normalize.ts) since the source has no
// stable ID; PlayerValuation upserts on (player_id, source, season_year).
//
// Usage: node --env-file=.env --import tsx server/ingestion/run.ts <auction-values-csv> [bye-weeks-csv]
//
// The auction-value CSV path has no default — it's a dated, gitignored
// weekly drop (server/ingestion/data/NFL_Auction_Values_*.csv), so there is
// no single "current" file to assume. The bye-week CSV changes roughly once
// a season and is committed, so it defaults to data/Bye_Weeks.csv.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { PoolClient } from 'pg'

import { pool } from '../db/pool'
import { playerMatchKey } from './normalize'
import { parseAuctionValues, type AuctionValueRow } from './sources/auctionValues'
import { parseByeWeeks, type ByeWeekRow } from './sources/byeWeeks'

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const DEFAULT_BYE_WEEKS_PATH = path.join(DATA_DIR, 'Bye_Weeks.csv')

// Matches the "2026-2027" label on the current bye-week source
// (docs/datamodel.md).
const SEASON_YEAR = 2026

interface ExistingPlayerRow {
  id: number
  name: string
  position_code: string
}

async function upsertTeams(client: PoolClient, rows: ByeWeekRow[]): Promise<number> {
  for (const row of rows) {
    await client.query(
      `INSERT INTO team (code, display_name, bye_week)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET display_name = EXCLUDED.display_name, bye_week = EXCLUDED.bye_week`,
      [row.code, row.displayName, row.byeWeek],
    )
  }
  return rows.length
}

async function upsertPlayersAndValuations(
  client: PoolClient,
  rows: AuctionValueRow[],
): Promise<{ playersInserted: number; playersUpdated: number; valuationsUpserted: number }> {
  const { rows: existing } = await client.query<ExistingPlayerRow>('SELECT id, name, position_code FROM player')

  const playerIdByMatchKey = new Map<string, number>()
  for (const existingPlayer of existing) {
    playerIdByMatchKey.set(playerMatchKey(existingPlayer.name, existingPlayer.position_code), existingPlayer.id)
  }

  let playersInserted = 0
  let playersUpdated = 0
  let valuationsUpserted = 0

  for (const row of rows) {
    const matchKey = playerMatchKey(row.name, row.position)
    let playerId = playerIdByMatchKey.get(matchKey)

    if (playerId) {
      // team_code is overwritten every run — this is what makes a trade
      // update the existing player in place rather than duplicating them.
      await client.query('UPDATE player SET team_code = $1 WHERE id = $2', [row.teamCode, playerId])
      playersUpdated += 1
    } else {
      const { rows: insertedRows } = await client.query<{ id: number }>(
        `INSERT INTO player (name, team_code, position_code) VALUES ($1, $2, $3) RETURNING id`,
        [row.name, row.teamCode, row.position],
      )
      playerId = insertedRows[0].id
      playerIdByMatchKey.set(matchKey, playerId)
      playersInserted += 1
    }

    for (const [source, value] of [
      ['espn', row.espnValue],
      ['yahoo', row.yahooValue],
    ] as const) {
      await client.query(
        `INSERT INTO player_valuation (player_id, source_code, auction_value, season_year, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (player_id, source_code, season_year)
         DO UPDATE SET auction_value = EXCLUDED.auction_value, updated_at = EXCLUDED.updated_at`,
        [playerId, source, value, SEASON_YEAR],
      )
      valuationsUpserted += 1
    }
  }

  return { playersInserted, playersUpdated, valuationsUpserted }
}

async function ingest(auctionValuesPath: string, byeWeeksPath: string): Promise<Record<string, number>> {
  const byeWeekRows = parseByeWeeks(byeWeeksPath)
  const auctionValueRows = parseAuctionValues(auctionValuesPath)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    try {
      const teamCount = await upsertTeams(client, byeWeekRows)
      const { playersInserted, playersUpdated, valuationsUpserted } = await upsertPlayersAndValuations(
        client,
        auctionValueRows,
      )
      await client.query('COMMIT')

      return {
        teams_upserted: teamCount,
        players_inserted: playersInserted,
        players_updated: playersUpdated,
        valuations_upserted: valuationsUpserted,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  } finally {
    client.release()
    await pool.end()
  }
}

async function run(): Promise<void> {
  const auctionValuesPath = process.argv[2]
  const byeWeeksPath = process.argv[3] ?? DEFAULT_BYE_WEEKS_PATH

  if (!auctionValuesPath) {
    throw new Error(
      'Usage: node --env-file=.env --import tsx server/ingestion/run.ts <auction-values-csv> [bye-weeks-csv]\n' +
        `Bye-weeks defaults to ${DEFAULT_BYE_WEEKS_PATH} if omitted.`,
    )
  }

  const counts = await ingest(auctionValuesPath, byeWeeksPath)

  const width = Math.max(...Object.keys(counts).map((label) => label.length))
  console.log('Ingested:')
  for (const [label, count] of Object.entries(counts)) {
    console.log(`  ${label.padEnd(width)}  ${count}`)
  }
}

run().catch((error: unknown) => {
  console.error(`Ingestion failed (no changes committed): ${(error as Error).message}`)
  process.exitCode = 1
})
