// Composes PlayerList, FavoritesList, and Roster (which itself renders the
// compact BudgetDisplay next to its heading) against the hooks/services
// already built. The only logic here is the K/DST pool-visibility filter,
// which docs/datamodel.md explicitly calls a "UI-layer filter on the
// existing Position field" rather than something that belongs in utils/.

import { useEffect, useMemo } from 'react'
import { getPlayers } from '../../services/playerService'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useElementHeight } from '../../hooks/useElementHeight'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import DataStatus from '../../components/DataStatus/DataStatus'
import Roster from '../../components/Roster/Roster'
import PlayerList from '../../components/PlayerList/PlayerList'
import FavoritesList from '../../components/FavoritesList/FavoritesList'
import type { RosterPositionSlot } from '../../types/League'
import type { ToggleState } from '../../utils/rosterAssignment'
import type { UseRosterResult } from '../../hooks/useRoster'
import type { UseFavoritesResult } from '../../hooks/useFavorites'

// Matches Tailwind's default lg breakpoint — the same one Draft's grid uses
// (grid-cols-1 lg:grid-cols-[1fr_280px]) to switch from stacked to
// two-column. Kept as one literal so the JS-side "are we in the two-column
// layout" check can never silently drift from the CSS one.
const WIDE_LAYOUT_QUERY = '(min-width: 1024px)'

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

  // A RosterAssignment rehydrated from sessionStorage can reference a
  // playerId the current pool no longer has (e.g. a data refresh removed or
  // re-identified that player) — this can only be checked once the real
  // pool has loaded, so it runs here as a one-time correction rather than
  // as part of reading storage itself (see pruneAssignmentsForKnownPlayers
  // in useRoster.ts). pruneUnknownPlayers is a stable useCallback and
  // players/status only change on real transitions, so this fires once per
  // load rather than every render.
  useEffect(() => {
    if (status === 'ready') {
      roster.pruneUnknownPlayers(players)
    }
  }, [status, players, roster.pruneUnknownPlayers])

  const visiblePlayers = players.filter(
    (player) =>
      (player.position !== 'K' || toggles.kickerEnabled) &&
      (player.position !== 'DST' || toggles.defenseEnabled),
  )

  // CSS alone can't express "Players' height matches Roster+Favorites'
  // natural height while scrolling internally": flex-grow/grid stretch only
  // resolve against an already-definite container height, and nothing on
  // this page has one (min-h-screen is a minimum, not definite — the page
  // is meant to scroll normally, not lock to the viewport). Measuring the
  // Roster+Favorites column here supplies that missing definite number;
  // isWideLayout gates it to the same breakpoint as the CSS grid so the
  // stacked/narrow layout's fixed-height behavior is untouched below it.
  const [rosterColumnRef, rosterColumnHeight] = useElementHeight<HTMLDivElement>()
  const isWideLayout = useMediaQuery(WIDE_LAYOUT_QUERY)
  const playerListMatchHeight = isWideLayout ? rosterColumnHeight : undefined

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
            onClearRoster={roster.clearRoster}
            matchHeight={playerListMatchHeight}
          />

          <div ref={rosterColumnRef} className="space-y-6">
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
