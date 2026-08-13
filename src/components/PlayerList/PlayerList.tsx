// Renders the available player pool as a table (Player, Position, Team,
// Bye, Yahoo, ESPN, Avg), with a position filter above it and a rejection
// message when draftPlayer (from useRoster, passed down as onDraft)
// rejects a click — mapped to plain language per rosterAssignment.ts's
// documented reasons, not a hard error.

import { useState } from 'react'
import PlayerRow from '../PlayerRow/PlayerRow'
import PlayerFilters from '../PlayerFilters/PlayerFilters'
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
const PLAYER_LIST_MAX_HEIGHT = '720px'

interface PlayerListProps {
  players: PlayerWithValuations[]
  isPlayerDrafted: (playerId: string) => boolean
  isFavorited: (playerId: string) => boolean
  onDraft: (player: PlayerWithValuations) => DraftPlayerResult
  onToggleFavorite: (playerId: string) => void
}

function PlayerList({ players, isPlayerDrafted, isFavorited, onDraft, onToggleFavorite }: PlayerListProps) {
  const [selectedPosition, setSelectedPosition] = useState<PositionCode | 'ALL'>('ALL')
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null)

  const positions = Array.from(new Set(players.map((p) => p.position)))
  const filtered =
    selectedPosition === 'ALL' ? players : players.filter((p) => p.position === selectedPosition)

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

  return (
    <section aria-label="Player pool" className="rounded-lg border border-slate-200 bg-parchment p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">Players</h2>
      <PlayerFilters
        positions={positions}
        selectedPosition={selectedPosition}
        onSelectPosition={setSelectedPosition}
      />

      {rejectionMessage && (
        <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {rejectionMessage}
        </p>
      )}

      <div
        className="mt-3 overflow-y-auto overflow-x-auto rounded-md border border-slate-200"
        style={{ maxHeight: PLAYER_LIST_MAX_HEIGHT }}
      >
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase text-slate-500">
              <th className="sticky top-0 z-10 border-b border-slate-200 bg-parchment py-2 pr-2">Player</th>
              <th className="sticky top-0 z-10 border-b border-slate-200 bg-parchment py-2 pr-2">Position</th>
              <th className="sticky top-0 z-10 border-b border-slate-200 bg-parchment py-2 pr-2">Team</th>
              <th className="sticky top-0 z-10 border-b border-slate-200 bg-parchment py-2 pr-2">Bye</th>
              <th className="sticky top-0 z-10 border-b border-slate-200 bg-parchment py-2 pr-2">Yahoo</th>
              <th className="sticky top-0 z-10 border-b border-slate-200 bg-parchment py-2 pr-2">ESPN</th>
              <th className="sticky top-0 z-10 border-b border-slate-200 bg-parchment py-2 pr-2">Avg</th>
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
    </section>
  )
}

export default PlayerList
