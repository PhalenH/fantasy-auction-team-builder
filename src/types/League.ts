import type { PositionCode } from './Player'

export type LeagueFormatKey = 'regular' | 'regular_3wr' | 'double_flex'

export interface LeagueFormat {
  id: string
  key: LeagueFormatKey
  displayName: string
}

// Tags the K and DST slots so they can be included/excluded per DraftSession
// without being baked into a format-specific slot row. Every other slot's
// toggleKey is null (always active). See DraftSession in Roster.ts.
export type ToggleKey = 'kicker' | 'defense'

export interface RosterPositionSlot {
  id: string
  leagueFormatId: string
  slotLabel: string
  count: number
  eligiblePositions: PositionCode[]
  sortOrder: number
  toggleKey: ToggleKey | null
}

// The shape services/leagueService.ts's getLeagueFormats() resolves to — a
// format with its roster slots embedded, matching how a real API
// response/join would look.
export interface LeagueFormatWithSlots extends LeagueFormat {
  slots: RosterPositionSlot[]
}
