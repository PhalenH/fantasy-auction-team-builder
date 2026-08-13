// Composes PlayerList, FavoritesList, and Roster (which itself renders the
// compact BudgetDisplay next to its heading) against the hooks/services
// already built. The only logic here is the K/DST pool-visibility filter,
// which docs/datamodel.md explicitly calls a "UI-layer filter on the
// existing Position field" rather than something that belongs in utils/.

import { useMemo } from 'react'
import { getPlayers } from '../../services/playerService'
import { useAsyncData } from '../../hooks/useAsyncData'
import DataStatus from '../../components/DataStatus/DataStatus'
import Roster from '../../components/Roster/Roster'
import PlayerList from '../../components/PlayerList/PlayerList'
import FavoritesList from '../../components/FavoritesList/FavoritesList'
import type { RosterPositionSlot } from '../../types/League'
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
  // The player pool comes from the API now, so this load can fail.
  const { data, status, error } = useAsyncData(getPlayers)
  const players = useMemo(() => data ?? [], [data])

  const visiblePlayers = players.filter(
    (player) =>
      (player.position !== 'K' || toggles.kickerEnabled) &&
      (player.position !== 'DST' || toggles.defenseEnabled),
  )

  // Roster and Favorites both resolve player names out of this same list, so
  // there's nothing meaningful to render until it arrives.
  if (status !== 'ready') {
    return (
      <div className="min-h-screen w-full bg-page-dark spotlight-sweep animate-spotlight-sweep motion-reduce:animate-none p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <h1 className="text-2xl font-bold text-white">Draft</h1>
          {/* DataStatus's own text colors are tuned for a light background
              (it's shared with App.tsx's page, which isn't dark) — wrapping
              it in the same white panel treatment as the ready-state panels
              below keeps it legible here without touching the shared
              component or its styling on other pages. */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <DataStatus status={status} loadingLabel="Loading players…" error={error} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-page-dark spotlight-sweep animate-spotlight-sweep motion-reduce:animate-none p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-2xl font-bold text-white">Draft</h1>

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
              onUpdatePrice={roster.updatePrice}
              budget={budget}
              spent={roster.spent}
              remaining={roster.remaining}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Draft
