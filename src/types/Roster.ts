// Frontend-only session state, per CLAUDE.md's Session Isolation rule and
// docs/datamodel.md's "Frontend-only / session state" section. None of
// these are ever written back to Player or any shared/server-side data —
// they live in React state (and optionally localStorage) for the current
// browser session only.

export interface DraftSession {
  leagueFormatId: string
  budget: number
  defenseEnabled: boolean
  kickerEnabled: boolean
}

// slotInstanceId distinguishes individual slots within a RosterPositionSlot
// whose count > 1 (e.g. the two RB slots), since a Player can only occupy
// one at a time.
export interface RosterAssignment {
  slotInstanceId: string
  playerId: string
  pricePaid: number
}

// Membership in this list is what determines "favorited" status — it is
// not a flag stored on Player.
export type FavoritePlayerIds = string[]
