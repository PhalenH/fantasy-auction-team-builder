// The seam between the frontend and the backend (see CLAUDE.md's Frontend
// Structure notes). Components/hooks call getPlayers(); they never know
// where the data comes from.
//
// This now reads the real API instead of data/mockPlayers.ts. That mock file
// is deliberately NOT deleted — server/seed/seed.ts still imports it as the
// single source of truth for what gets seeded into Postgres, and the web
// tests use it to build fetch fixtures.

import { fetchJson } from './apiClient'
import type { PlayerWithValuations } from '../types/Player'

// GET /api/players returns players with their valuations already embedded,
// and deliberately no combined value — that stays derived client-side by
// utils/auctionCalculations.ts, exactly as it was over mock data.
export async function getPlayers(): Promise<PlayerWithValuations[]> {
  return fetchJson<PlayerWithValuations[]>('/api/players', 'players')
}
