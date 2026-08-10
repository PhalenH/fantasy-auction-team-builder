// A compact row for the narrower Favorites column — name, position, and
// combined value only, rather than PlayerRow's full 7 columns. Not the
// same component as PlayerRow (doesn't need to be), but drives drafting/
// favoriting through the same onDraft/onToggleFavorite callbacks, so it
// stays in sync with useRoster/useFavorites exactly like PlayerRow does.
// Same aria-label conventions as PlayerRow, for the same reason.

import { getCombinedAuctionValue } from '../../utils/auctionCalculations'
import type { PlayerWithValuations } from '../../types/Player'

interface FavoriteRowProps {
  player: PlayerWithValuations
  isDrafted: boolean
  onDraft: (player: PlayerWithValuations) => void
  onToggleFavorite: (playerId: string) => void
}

function formatMoney(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(2)}`
}

function FavoriteRow({ player, isDrafted, onDraft, onToggleFavorite }: FavoriteRowProps) {
  const combined = getCombinedAuctionValue(player.valuations)

  function handleRowClick() {
    if (!isDrafted) onDraft(player)
  }

  return (
    <div
      onClick={handleRowClick}
      className={`rounded-md border px-2 py-1.5 text-sm ${
        isDrafted
          ? 'border-slate-200 bg-slate-100 opacity-60'
          : 'cursor-pointer border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite(player.id)
          }}
          aria-label={`Unfavorite ${player.name}`}
          aria-pressed={true}
          className="shrink-0 text-base leading-none"
        >
          <span className="text-amber-500">★</span>
        </button>

        {/*
          Name gets the row's full remaining width on its own line — not
          sharing it with price/badge — and isn't truncated, so it's never
          squeezed into an ellipsis regardless of length.
        */}
        <button
          type="button"
          disabled={isDrafted}
          onClick={(event) => {
            event.stopPropagation()
            onDraft(player)
          }}
          aria-label={isDrafted ? `${player.name}, already drafted` : `Draft ${player.name}`}
          className="min-w-0 flex-1 text-left font-medium text-slate-900 disabled:cursor-not-allowed"
        >
          {player.name}
        </button>

        {isDrafted && (
          <span className="shrink-0 rounded-full bg-slate-300 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
            Drafted
          </span>
        )}
      </div>

      {/* pl-6 (star width + gap-2) lines this up under the name text. */}
      <div className="mt-0.5 flex items-center justify-between pl-6 text-xs text-slate-500">
        <span>
          {player.position} · Bye {player.byeWeek}
        </span>
        <span className="font-medium text-slate-700">{formatMoney(combined)}</span>
      </div>
    </div>
  )
}

export default FavoriteRow
