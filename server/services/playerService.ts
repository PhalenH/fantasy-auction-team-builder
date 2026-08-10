// Query layer for player data — the only place that touches the pool for
// players. Routes call this and serialize the result; they never see SQL or
// a raw row (CLAUDE.md: business logic out of the delivery layer).
//
// Return types are the FRONTEND's own types, imported type-only from
// src/types/. That makes the API contract compiler-enforced: if a mapping
// here stops matching what src/services/playerService.ts already returns
// from mock data, `npm run build` fails. Type imports are erased at runtime,
// so this couples nothing but the shape.

import type { Pool } from 'pg'

import type {
  PlayerValuation,
  PlayerWithValuations,
  PositionCode,
  ValuationSourceCode,
} from '../../src/types/Player'

// Shapes as Postgres actually returns them — deliberately distinct from the
// frontend types, since three columns need conversion (see below).
interface PlayerRow {
  id: number
  name: string
  nfl_team: string
  position_code: PositionCode
  bye_week: number
  espn_player_id: string | null
  yahoo_player_id: string | null
}

interface ValuationRow {
  id: number
  player_id: number
  source_code: ValuationSourceCode
  // NUMERIC arrives as a string from the pg driver, not a number.
  auction_value: string
  season_year: number
  // TIMESTAMPTZ arrives as a JS Date, not a string.
  updated_at: Date
}

// ORDER BY id reproduces the seeded insertion order, so the payload order
// matches the mock array the frontend is currently tested against.
const PLAYERS_SQL = `
  SELECT id, name, nfl_team, position_code, bye_week, espn_player_id, yahoo_player_id
  FROM player
  ORDER BY id
`

const VALUATIONS_SQL = `
  SELECT id, player_id, source_code, auction_value, season_year, updated_at
  FROM player_valuation
  ORDER BY player_id, id
`

function toValuation(row: ValuationRow): PlayerValuation {
  return {
    id: String(row.id),
    playerId: String(row.player_id),
    source: row.source_code,
    // Number(), not parseFloat/unary-plus-by-habit: the frontend type says
    // number, and auctionCalculations.ts averages these.
    auctionValue: Number(row.auction_value),
    seasonYear: row.season_year,
    updatedAt: row.updated_at.toISOString(),
  }
}

/**
 * Every player with their valuations embedded — the same shape
 * src/services/playerService.ts returns from mock data.
 *
 * Deliberately does NOT attach a combined/calculated value: that stays
 * derived client-side by utils/auctionCalculations.ts, per CLAUDE.md and
 * docs/datamodel.md.
 */
export async function getPlayers(db: Pool): Promise<PlayerWithValuations[]> {
  // Two queries total regardless of player count — not one per player.
  const [players, valuations] = await Promise.all([
    db.query<PlayerRow>(PLAYERS_SQL),
    db.query<ValuationRow>(VALUATIONS_SQL),
  ])

  const valuationsByPlayerId = new Map<number, PlayerValuation[]>()
  for (const row of valuations.rows) {
    const existing = valuationsByPlayerId.get(row.player_id)
    if (existing) {
      existing.push(toValuation(row))
    } else {
      valuationsByPlayerId.set(row.player_id, [toValuation(row)])
    }
  }

  return players.rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    nflTeam: row.nfl_team,
    position: row.position_code,
    byeWeek: row.bye_week,
    // The frontend type declares these optional (string | undefined), so a
    // NULL column becomes undefined — which JSON.stringify omits entirely.
    // Emitting null instead would violate the declared contract.
    espnPlayerId: row.espn_player_id ?? undefined,
    yahooPlayerId: row.yahoo_player_id ?? undefined,
    valuations: valuationsByPlayerId.get(row.id) ?? [],
  }))
}
