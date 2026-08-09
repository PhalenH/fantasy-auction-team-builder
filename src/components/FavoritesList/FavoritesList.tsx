// Favorited players, in their own section, via the compact FavoriteRow
// (see FavoriteRow.tsx for why this isn't PlayerRow). Stacks vertically
// and grows with the favorites count — no fixed height or scroll box.
// Drafting from here goes through the same onDraft/rejection-message
// handling as PlayerList.

import { useState } from 'react'
import FavoriteRow from './FavoriteRow'
import { ASSIGNMENT_REJECTION_MESSAGES } from '../PlayerList/rejectionMessages'
import type { PlayerWithValuations } from '../../types/Player'
import type { DraftPlayerResult } from '../../hooks/useRoster'

interface FavoritesListProps {
  players: PlayerWithValuations[]
  favoriteIds: string[]
  isPlayerDrafted: (playerId: string) => boolean
  onDraft: (player: PlayerWithValuations) => DraftPlayerResult
  onToggleFavorite: (playerId: string) => void
}

function FavoritesList({
  players,
  favoriteIds,
  isPlayerDrafted,
  onDraft,
  onToggleFavorite,
}: FavoritesListProps) {
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null)
  const favorites = players.filter((p) => favoriteIds.includes(p.id))

  function handleDraft(player: PlayerWithValuations) {
    const result = onDraft(player)
    setRejectionMessage(result.ok ? null : ASSIGNMENT_REJECTION_MESSAGES[result.reason])
  }

  return (
    <section aria-label="Favorite players">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">Favorites</h2>

      {rejectionMessage && (
        <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {rejectionMessage}
        </p>
      )}

      {favorites.length === 0 ? (
        <p className="text-sm text-slate-500">No favorites yet.</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {favorites.map((player) => (
            <FavoriteRow
              key={player.id}
              player={player}
              isDrafted={isPlayerDrafted(player.id)}
              onDraft={handleDraft}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default FavoritesList
