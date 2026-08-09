// Composes PlayerList, FavoritesList, and Roster (which itself renders the
// compact BudgetDisplay next to its heading) against the hooks/services
// already built. The only logic here is the K/DST pool-visibility filter,
// which docs/datamodel.md explicitly calls a "UI-layer filter on the
// existing Position field" rather than something that belongs in utils/.

import { useEffect, useState } from 'react'
import { getPlayers } from '../../services/playerService'
import Roster from '../../components/Roster/Roster'
import PlayerList from '../../components/PlayerList/PlayerList'
import FavoritesList from '../../components/FavoritesList/FavoritesList'
import type { RosterPositionSlot } from '../../types/League'
import type { PlayerWithValuations } from '../../types/Player'
import type { ToggleState } from '../../utils/rosterAssignment'
import type { UseRosterResult } from '../../hooks/useRoster'
import type { UseFavoritesResult } from '../../hooks/useFavorites'

interface DraftProps {
  slots: RosterPositionSlot[]
  toggles: ToggleState
  budget: number
  roster: UseRosterResult
  favorites: UseFavoritesResult
}

function Draft({ slots, toggles, budget, roster, favorites }: DraftProps) {
  const [players, setPlayers] = useState<PlayerWithValuations[]>([])

  useEffect(() => {
    getPlayers().then(setPlayers)
  }, [])

  const visiblePlayers = players.filter(
    (player) =>
      (player.position !== 'K' || toggles.kickerEnabled) &&
      (player.position !== 'DST' || toggles.defenseEnabled),
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-slate-900">Draft</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <PlayerList
          players={visiblePlayers}
          isPlayerDrafted={roster.isPlayerDrafted}
          isFavorited={favorites.isFavorited}
          onDraft={roster.draftPlayer}
          onToggleFavorite={favorites.toggleFavorite}
        />

        <div className="space-y-6">
          <FavoritesList
            players={visiblePlayers}
            favoriteIds={favorites.favoriteIds}
            isPlayerDrafted={roster.isPlayerDrafted}
            onDraft={roster.draftPlayer}
            onToggleFavorite={favorites.toggleFavorite}
          />
          <Roster
            slots={slots}
            toggles={toggles}
            assignments={roster.assignments}
            players={players}
            onUndraft={roster.undraftPlayer}
            budget={budget}
            spent={roster.spent}
            remaining={roster.remaining}
          />
        </div>
      </div>
    </div>
  )
}

export default Draft
