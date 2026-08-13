// Owns the favorite player id-set for the current session (see CLAUDE.md's
// Favorites section — independent of roster-drafted status, never written
// back to Player). Add/remove-from-set is a small pure function, kept
// separate from the React state wiring so it's directly unit-testable per
// CLAUDE.md's "write tests for favorites toggling" rule. Mirrored into the
// shared sessionStorage blob (see sessionPersistence.ts) so it survives a
// page refresh, per CLAUDE.md's Session Isolation "Optional enhancement".

import { useCallback, useEffect, useRef, useState } from 'react'
import { readPersistedSession, writePersistedSessionSlice } from './sessionPersistence'
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
  // Ref rather than a module-level read, same reasoning as useDraftSession:
  // each hook instance should re-read sessionStorage at its own mount time.
  const persistedRef = useRef<FavoritePlayerIds | undefined>(undefined)
  if (persistedRef.current === undefined) {
    persistedRef.current = readPersistedSession()?.favoriteIds ?? []
  }

  const [favoriteIds, setFavoriteIds] = useState<FavoritePlayerIds>(persistedRef.current)

  useEffect(() => {
    writePersistedSessionSlice({ favoriteIds })
  }, [favoriteIds])

  const isFavorited = useCallback(
    (playerId: string) => favoriteIds.includes(playerId),
    [favoriteIds],
  )

  const toggleFavorite = useCallback((playerId: string) => {
    setFavoriteIds((prev) => toggleFavoriteId(prev, playerId))
  }, [])

  return { favoriteIds, isFavorited, toggleFavorite }
}
