// Frontend-only session state, per CLAUDE.md's Session Isolation rule and
// docs/datamodel.md's "Frontend-only / session state" section. None of
// these are ever written back to Player or any shared/server-side data —
// they live in React state (and optionally localStorage) for the current
// browser session only.

import type { PositionCode } from './Player'
import type { LeagueFormatKey } from './League'

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
  // Present only when this assignment was hydrated from a SavedRoster whose
  // playerId no longer resolves in the live player pool (see
  // hydrateAssignmentsFromSavedRoster in hooks/useRoster.ts and
  // docs/saved_rosters_plan.md's resume-flow edge case) — a frozen
  // denormalized snapshot so the slot still renders correctly and its price
  // still counts toward spend, even though there's no live Player row to
  // join against. Absent for every normally-drafted assignment.
  unresolvedPlayer?: {
    name: string
    teamCode: string
    position: PositionCode
  }
}

// Membership in this list is what determines "favorited" status — it is
// not a flag stored on Player.
export type FavoritePlayerIds = string[]

// A frozen roster snapshot the user explicitly saved (docs/saved_rosters_plan.md).
// Lives in its own localStorage key (see hooks/useSavedRosters.ts) — a
// separate mechanism entirely from the sessionStorage-backed DraftSession/
// RosterAssignment/FavoritePlayerIds above, since it must survive closing
// the tab/browser, which the in-progress draft session deliberately does
// not (see sessionPersistence.ts).
export interface SavedRosterAssignment {
  slotLabel: string
  slotInstanceId: string
  playerId: string
  // Denormalized (not just playerId) so a save still renders correctly
  // months later even if the real Player row has drifted — see
  // docs/saved_rosters_plan.md's note on the (name, position) ingestion
  // match key.
  playerName: string
  playerTeam: string
  playerPosition: PositionCode
  pricePaid: number
}

export interface SavedRoster {
  id: string
  name: string
  savedAt: string
  leagueFormatKey: LeagueFormatKey
  budget: number
  defenseEnabled: boolean
  kickerEnabled: boolean
  totalSpent: number
  remainingBudget: number
  assignments: SavedRosterAssignment[]
}
