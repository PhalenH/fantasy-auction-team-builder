// Position and ValuationSource are lookup tables in docs/datamodel.md, not
// hardcoded enums — the union types below are the frontend/mock-data
// equivalent of those tables' `code` column, used as the FK value on
// Player.position and PlayerValuation.source.

export type PositionCode = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST'

export interface Position {
  code: PositionCode
  displayName: string
}

export type ValuationSourceCode = 'espn' | 'yahoo'

export interface ValuationSource {
  code: ValuationSourceCode
  displayName: string
}

// Lookup table (docs/datamodel.md), not a hardcoded enum — a typo'd team
// code is rejected by a foreign key rather than silently inserted, and a
// bye-week schedule correction is one row update instead of a sweep across
// every player on that team.
export interface Team {
  code: string
  displayName: string
  byeWeek: number
}

export interface Player {
  id: string
  name: string
  teamCode: string
  // Joined from Team, not a Player column — see docs/datamodel.md's
  // real-ingestion section. Carried as flat fields here (rather than a
  // nested `team` object) to match how byeWeek was already shaped before
  // Team existed as its own entity.
  teamDisplayName: string
  position: PositionCode
  byeWeek: number
  // Reserved for real ESPN/Yahoo ingestion to match against existing
  // records later — unused by mock data, and permanently unpopulated by the
  // current (name, position)-matched real ingestion pipeline too.
  espnPlayerId?: string
  yahooPlayerId?: string
}

// One row per (player, source). Combined/calculated value is deliberately
// NOT part of this shape — it's derived from these rows by a function in
// utils/auctionCalculations.ts, not stored.
export interface PlayerValuation {
  id: string
  playerId: string
  source: ValuationSourceCode
  auctionValue: number
  seasonYear: number
  updatedAt: string
}

// The shape services/playerService.ts's getPlayers() resolves to — a
// player with its valuations embedded, matching how a real API
// response/join would look. Still no combined value here; that stays
// derived via getCombinedAuctionValue whenever it's actually needed.
export interface PlayerWithValuations extends Player {
  valuations: PlayerValuation[]
}
