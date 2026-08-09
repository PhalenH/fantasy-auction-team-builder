// The seam between mock data and a real backend (see CLAUDE.md's Frontend
// Structure notes). Components/hooks should call getPlayers(), never import
// data/mockPlayers.ts directly — swapping this to a real fetch() later
// means editing only this file.

import { players, playerValuations } from '../data/mockPlayers'
import type { PlayerWithValuations } from '../types/Player'

// Typed as async even though it's synchronous today, so callers already
// treat it as async and a real fetch() drop-in requires no caller changes.
export async function getPlayers(): Promise<PlayerWithValuations[]> {
  return players.map((player) => ({
    ...player,
    valuations: playerValuations.filter((v) => v.playerId === player.id),
  }))
}
