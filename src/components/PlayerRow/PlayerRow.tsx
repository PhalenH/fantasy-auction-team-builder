// One <tr> in PlayerList's table. Preserves the same aria-label
// conventions PlayerCard used ("Draft {name}" / "{name}, already drafted"
// / "Favorite {name}" / "Unfavorite {name}") so the accessible contract —
// and most existing queries against it — stay stable across the card ->
// table markup change.
//
// The favorite button stops propagation before the row's own onClick can
// fire, and the name button does too — so drafting and favoriting stay
// independent exactly as they were with PlayerCard's sibling buttons.

import { getCombinedAuctionValue } from '../../utils/auctionCalculations'
import { POSITION_TINTS } from '../positionColors'
import type { PlayerWithValuations } from '../../types/Player'

interface PlayerRowProps {
  player: PlayerWithValuations
  isDrafted: boolean
  isFavorited: boolean
  onDraft: (player: PlayerWithValuations) => void
  onToggleFavorite: (playerId: string) => void
}

function formatMoney(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(2)}`
}

function PlayerRow({ player, isDrafted, isFavorited, onDraft, onToggleFavorite }: PlayerRowProps) {
  const espn = player.valuations.find((v) => v.source === 'espn')?.auctionValue ?? null
  const yahoo = player.valuations.find((v) => v.source === 'yahoo')?.auctionValue ?? null
  const combined = getCombinedAuctionValue(player.valuations)

  function handleRowClick() {
    if (!isDrafted) onDraft(player)
  }

  return (
    <tr
      onClick={handleRowClick}
      className={`border-b border-slate-100 text-sm ${POSITION_TINTS[player.position]} ${
        isDrafted ? 'opacity-60' : 'cursor-pointer hover:brightness-95'
      }`}
    >
      <td className="py-2 pr-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleFavorite(player.id)
            }}
            aria-label={isFavorited ? `Unfavorite ${player.name}` : `Favorite ${player.name}`}
            aria-pressed={isFavorited}
            className="shrink-0 text-base leading-none"
          >
            <span className={isFavorited ? 'text-amber-500' : 'text-slate-300'}>★</span>
          </button>

          <button
            type="button"
            disabled={isDrafted}
            onClick={(event) => {
              event.stopPropagation()
              onDraft(player)
            }}
            aria-label={isDrafted ? `${player.name}, already drafted` : `Draft ${player.name}`}
            className="text-left font-semibold text-slate-900 disabled:cursor-not-allowed"
          >
            {player.name}
          </button>

          {isDrafted && (
            <span className="inline-block shrink-0 rounded-full bg-slate-300 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
              Drafted
            </span>
          )}
        </div>
      </td>
      <td className="py-2 pr-2 text-slate-600">{player.position}</td>
      <td className="py-2 pr-2 text-slate-600">{player.nflTeam}</td>
      <td className="py-2 pr-2 text-slate-600">{player.byeWeek}</td>
      <td className="py-2 pr-2 text-slate-600">{formatMoney(yahoo)}</td>
      <td className="py-2 pr-2 text-slate-600">{formatMoney(espn)}</td>
      <td className="py-2 pr-2 font-medium text-slate-900">{formatMoney(combined)}</td>
    </tr>
  )
}

export default PlayerRow
