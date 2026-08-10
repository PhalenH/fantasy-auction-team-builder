import { SLOT_BADGE_TINTS } from '../positionColors'
import type { PlayerWithValuations } from '../../types/Player'

interface RosterSlotProps {
  slotLabel: string
  player: PlayerWithValuations | null
  pricePaid: number | null
  onUndraft: (playerId: string) => void
}

function RosterSlot({ slotLabel, player, pricePaid, onUndraft }: RosterSlotProps) {
  return (
    // items-stretch (flex's default, made explicit here) is what makes the
    // badge span the full row height below — the badge and the name/bye
    // content div are siblings in the same flex row, so the badge stretches
    // to match however tall the content column ends up being, instead of
    // being sized for a single line and leaving blank space beside a
    // two-line (name + bye) row.
    <div className="flex items-stretch gap-2 rounded-md border border-slate-200 px-2 py-1 text-sm">
      <span
        className={`flex w-14 shrink-0 items-center justify-center rounded text-center font-mono text-xs font-semibold text-slate-700 ${
          SLOT_BADGE_TINTS[slotLabel] ?? 'bg-slate-100'
        }`}
      >
        {slotLabel}
      </span>

      <div className="min-w-0 flex-1">
        {player ? (
          // group/group-hover + group-focus-within drive the tooltip below:
          // shown on mouse hover of the name AND on keyboard focus, so it's
          // not a mouse-only affordance. The tooltip is purely decorative
          // (aria-hidden) — the button's aria-label already tells screen
          // readers what the click does.
          <div className="group relative">
            <button
              type="button"
              onClick={() => onUndraft(player.id)}
              aria-label={`Remove ${player.name} from roster`}
              className="block w-full text-left text-slate-900 hover:text-red-600 hover:underline"
            >
              {player.name}
            </button>
            <span
              role="tooltip"
              aria-hidden="true"
              className="pointer-events-none absolute bottom-full left-0 z-10 mb-1.5 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs font-normal text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              Click to remove from roster
              <span className="absolute left-3 top-full -mt-px h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-800" />
            </span>
          </div>
        ) : (
          <span className="text-slate-400">Empty</span>
        )}

        {player && (
          <div className="mt-0.5 flex items-center justify-between text-xs text-slate-500">
            <span>Bye {player.byeWeek}</span>
            {pricePaid !== null && (
              <span className="font-medium text-slate-700">${pricePaid.toFixed(2)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default RosterSlot
