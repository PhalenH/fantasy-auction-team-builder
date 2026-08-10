// The seam between the frontend and the backend (see CLAUDE.md's Frontend
// Structure notes). Components call getLeagueFormats(); they never know
// where the data comes from.
//
// data/leagueFormats.ts is no longer imported here, but is deliberately kept
// — server/seed/seed.ts seeds Postgres from it.

import { fetchJson } from './apiClient'
import type { LeagueFormatWithSlots } from '../types/League'

// GET /api/league-formats returns each format with its roster slots
// embedded, including the K/DST toggleKey tags.
export async function getLeagueFormats(): Promise<LeagueFormatWithSlots[]> {
  return fetchJson<LeagueFormatWithSlots[]>('/api/league-formats', 'league formats')
}
