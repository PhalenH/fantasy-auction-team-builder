// Owns the favorite player id-set for the current session (see CLAUDE.md's
// Favorites section — independent of roster-drafted status, never written
// back to Player). Add/remove-from-set is a small pure function, kept
// separate from the React state wiring so it's directly unit-testable per
// CLAUDE.md's "write tests for favorites toggling" rule.

import { useCallback, useState } from 'react'
import type { FavoritePlayerIds } from '../types/Roster'

export function toggleFavoriteId(
  favoriteIds: FavoritePlayerIds,
  playerId: string,
): FavoritePlayerIds {
  return favoriteIds.includes(playerId)
    ? favoriteIds.filter((id) => id !== playerId)
    : [...favoriteIds, playerId]
}

export interface UseFavoritesResult {
  favoriteIds: FavoritePlayerIds
  isFavorited: (playerId: string) => boolean
  toggleFavorite: (playerId: string) => void
}

export function useFavorites(): UseFavoritesResult {
  const [favoriteIds, setFavoriteIds] = useState<FavoritePlayerIds>([])

  const isFavorited = useCallback(
    (playerId: string) => favoriteIds.includes(playerId),
    [favoriteIds],
  )

  const toggleFavorite = useCallback((playerId: string) => {
    setFavoriteIds((prev) => toggleFavoriteId(prev, playerId))
  }, [])

  return { favoriteIds, isFavorited, toggleFavorite }
}
