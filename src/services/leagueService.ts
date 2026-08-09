// The seam between mock data and a real backend (see CLAUDE.md's Frontend
// Structure notes). Components/hooks should call getLeagueFormats(), never
// import data/leagueFormats.ts directly.

import { leagueFormats, rosterPositionSlots } from '../data/leagueFormats'
import type { LeagueFormatWithSlots } from '../types/League'

// Typed as async even though it's synchronous today, so callers already
// treat it as async and a real fetch() drop-in requires no caller changes.
export async function getLeagueFormats(): Promise<LeagueFormatWithSlots[]> {
  return leagueFormats.map((format) => ({
    ...format,
    slots: rosterPositionSlots.filter((slot) => slot.leagueFormatId === format.id),
  }))
}
