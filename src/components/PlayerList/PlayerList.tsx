// Renders the available player pool as a table (Player, Position, Team,
// Bye, Yahoo, ESPN, Avg), with a position filter above it and a rejection
// message when draftPlayer (from useRoster, passed down as onDraft)
// rejects a click — mapped to plain language per rosterAssignment.ts's
// documented reasons, not a hard error.

import { useState } from 'react'
import PlayerRow from '../PlayerRow/PlayerRow'
import PlayerFilters from '../PlayerFilters/PlayerFilters'
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog'
import { ASSIGNMENT_REJECTION_MESSAGES } from './rejectionMessages'
import { getCombinedAuctionValue } from '../../utils/auctionCalculations'
import type { PlayerWithValuations, PositionCode } from '../../types/Player'
import type { DraftPlayerResult } from '../../hooks/useRoster'

// ~20 rows tall including the sticky header row (rows run ~36px at
// text-sm/py-2, so 20 * 36 ≈ 720px). The filters/rejection banner sit
// outside this scroll box entirely, so they don't eat into the row budget
// and never need to be sticky — they're just never part of what scrolls.
// This is an estimate from the Tailwind spacing scale, not a measured
// browser render — adjust if the visible row count looks off live.
//
// Only the fallback for when matchHeight isn't supplied: below Draft.tsx's
// lg: breakpoint (stacked layout), or before its ResizeObserver has
// measured anything yet. CSS alone can't make this box match a sibling's
// natural content height while still scrolling internally — see
// useElementHeight's comment for why — so at lg: and above, Draft.tsx
// measures the Roster+Favorites column and passes its height down instead.
const PLAYER_LIST_MAX_HEIGHT = '720px'

interface PlayerListProps {
  players: PlayerWithValuations[]
  /**
   * Which positions the active format's FLEX slot(s) accept — see
   * utils/rosterAssignment.ts's getFlexEligiblePositions, computed by
   * Draft.tsx from the active format's slots. Backs both the FLEX filter
   * button's presence (PlayerFilters) and its filter predicate below, since
   * FLEX isn't itself a Position code that player.position can match.
   */
  flexEligiblePositions: PositionCode[]
  isPlayerDrafted: (playerId: string) => boolean
  isFavorited: (playerId: string) => boolean
  onDraft: (player: PlayerWithValuations) => DraftPlayerResult
  onToggleFavorite: (playerId: string) => void
  onClearRoster: () => void
  /**
   * The Roster+Favorites column's measured height in px, or undefined to
   * fall back to the fixed PLAYER_LIST_MAX_HEIGHT cap — undefined below
   * Draft.tsx's two-column breakpoint by design (see Draft.tsx), and
   * transiently undefined at lg: for one frame before the very first
   * ResizeObserver measurement lands.
   */
  matchHeight?: number
}

function PlayerList({
  players,
  flexEligiblePositions,
  isPlayerDrafted,
  isFavorited,
  onDraft,
  onToggleFavorite,
  onClearRoster,
  matchHeight,
}: PlayerListProps) {
  const [selectedPosition, setSelectedPosition] = useState<PositionCode | 'ALL' | 'FLEX'>('ALL')
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null)
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)

  const positions = Array.from(new Set(players.map((p) => p.position)))
  const filtered =
    selectedPosition === 'ALL'
      ? players
      : selectedPosition === 'FLEX'
        ? players.filter((p) => flexEligiblePositions.includes(p.position))
        : players.filter((p) => p.position === selectedPosition)

  // Default sort: highest combined auction value first. Not user-
  // toggleable — this is the only order the table renders in. Players with
  // no valuation data (combined value null) sort last rather than first.
  const visible = [...filtered].sort(
    (a, b) =>
      (getCombinedAuctionValue(b.valuations) ?? -Infinity) -
      (getCombinedAuctionValue(a.valuations) ?? -Infinity),
  )

  function handleDraft(player: PlayerWithValuations) {
    const result = onDraft(player)
    setRejectionMessage(result.ok ? null : ASSIGNMENT_REJECTION_MESSAGES[result.reason])
  }

  // Destructive, one-click, no-undo (frontend-only session state — nothing
  // to recover once cleared), so it's confirmed rather than firing
  // immediately, same as removing an assignment is a deliberate click on
  // the roster slot itself rather than a hover/drag accident. The
  // confirmation itself is the custom ConfirmDialog below, not
  // window.confirm() — its open/close state lives here since only this
  // component's button can trigger it.
  function handleClearRosterClick() {
    setIsClearConfirmOpen(true)
  }

  function handleConfirmClear() {
    setIsClearConfirmOpen(false)
    onClearRoster()
  }

  function handleCancelClear() {
    setIsClearConfirmOpen(false)
  }

  return (
    <section
      aria-label="Player pool"
      className={`rounded-lg border border-slate-200 bg-parchment p-4 shadow-sm ${
        matchHeight !== undefined ? 'flex min-h-0 flex-col' : ''
      }`}
      style={matchHeight !== undefined ? { height: matchHeight } : undefined}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Players</h2>

        {/* group/group-hover + group-focus-within tooltip: same pattern as
            RosterSlot's "Click to remove from roster" bubble, mirrored to
            open below-right instead of above-left since this sits at the
            very top of the panel (a tooltip opening upward would spill
            outside it). */}
        <div className="group relative">
          <button
            type="button"
            onClick={handleClearRosterClick}
            aria-label="Clear roster"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-base leading-none text-slate-500 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            ↻
          </button>
          <span
            role="tooltip"
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs font-normal text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            Refresh/clear current roster
            <span className="absolute right-3 bottom-full -mb-px h-2 w-2 translate-x-1/2 rotate-45 bg-slate-800" />
          </span>
        </div>
      </div>
      <PlayerFilters
        positions={positions}
        flexEligible={flexEligiblePositions.length > 0}
        selectedPosition={selectedPosition}
        onSelectPosition={setSelectedPosition}
      />

      {rejectionMessage && (
        <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {rejectionMessage}
        </p>
      )}

      <div
        className={`mt-3 overflow-y-auto overflow-x-auto rounded-md border border-slate-200 ${
          matchHeight !== undefined ? 'min-h-0 flex-1' : ''
        }`}
        style={matchHeight === undefined ? { maxHeight: PLAYER_LIST_MAX_HEIGHT } : undefined}
      >
        <table className="w-full min-w-160 table-fixed border-collapse">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase text-slate-500">
              <th className="sticky top-0 z-10 w-[36%] border-b border-slate-200 bg-parchment py-2 pr-2">Player</th>
              <th className="sticky top-0 z-10 w-[9%] border-b border-slate-200 bg-parchment py-2 pr-2">POS</th>
              <th className="sticky top-0 z-10 w-[8%] border-b border-slate-200 bg-parchment py-2 pr-2">Team</th>
              <th className="sticky top-0 z-10 w-[7%] border-b border-slate-200 bg-parchment py-2 pr-2">Bye</th>
              <th className="sticky top-0 z-10 w-[13%] border-b border-slate-200 bg-parchment py-2 pr-2">Yahoo</th>
              <th className="sticky top-0 z-10 w-[13%] border-b border-slate-200 bg-parchment py-2 pr-2">ESPN</th>
              <th className="sticky top-0 z-10 w-[14%] border-b border-slate-200 bg-parchment py-2 pr-2">Avg</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                isDrafted={isPlayerDrafted(player.id)}
                isFavorited={isFavorited(player.id)}
                onDraft={handleDraft}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={isClearConfirmOpen}
        title="Confirm"
        message="Clear your entire roster?"
        confirmLabel="OK"
        cancelLabel="Cancel"
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
      />
    </section>
  )
}

export default PlayerList
