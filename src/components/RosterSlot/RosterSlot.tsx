import { useRef, useState } from 'react'
import { MIN_PRICE, PRICE_INCREMENT } from '../../hooks/useRoster'
import { SLOT_BADGE_TINTS } from '../positionColors'

// The subset of a player Roster.tsx can actually supply for display here —
// either a real PlayerWithValuations (structurally compatible, so it's
// passed straight through) or a synthesized stand-in built from a
// RosterAssignment's unresolvedPlayer snapshot, which has no byeWeek since
// that was never part of what a SavedRoster denormalizes. See
// docs/saved_rosters_plan.md's resume-flow edge case.
export interface RosterSlotPlayer {
  id: string
  name: string
  byeWeek: number | null
}

interface RosterSlotProps {
  slotLabel: string
  player: RosterSlotPlayer | null
  pricePaid: number | null
  onUndraft: (playerId: string) => void
  onUpdatePrice: (newPrice: number) => void
}

// Mirrors <input type="number">'s own valueAsNumber (empty/invalid -> NaN)
// for the string form draftValue is tracked in below — Number('') would
// otherwise silently parse as 0, which is a real (if wrong) price.
function parseDraftValue(value: string): number {
  if (value.trim() === '') return NaN
  return Number(value)
}

function RosterSlot({ slotLabel, player, pricePaid, onUndraft, onUpdatePrice }: RosterSlotProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftValue, setDraftValue] = useState('')
  // Escape unmounts the focused input as a side effect of leaving edit mode,
  // and browsers fire a native blur when a focused element is removed —
  // without this flag, that blur would immediately re-commit right after
  // Escape already cancelled.
  const skipNextBlurRef = useRef(false)

  function startEditing() {
    if (pricePaid === null) return
    setDraftValue(String(pricePaid))
    setIsEditing(true)
  }

  function commit() {
    const parsed = parseDraftValue(draftValue)
    // An empty/invalid value on blur or Enter is treated like a cancel —
    // there's no sensible price to fall back to, and normalizePrice would
    // otherwise clamp NaN input to the $1 minimum, which reads as a typo
    // (not a deliberate $1 bid).
    if (Number.isFinite(parsed)) {
      onUpdatePrice(parsed)
    }
    setIsEditing(false)
  }

  function cancel() {
    skipNextBlurRef.current = true
    setIsEditing(false)
  }

  return (
    // items-stretch (flex's default, made explicit here) is what makes the
    // badge span the full row height below — the badge and the name/bye
    // content div are siblings in the same flex row, so the badge stretches
    // to match however tall the content column ends up being, instead of
    // being sized for a single line and leaving blank space beside a
    // two-line (name + bye) row.
    <div
      className={`flex items-stretch gap-2 rounded-md border px-2 py-1 text-sm ${
        player ? 'border-slate-400' : 'border-slate-200'
      }`}
    >
      <span
        className={`flex w-14 shrink-0 items-center justify-center rounded text-center font-mono text-xs font-semibold text-slate-700 ${
          SLOT_BADGE_TINTS[slotLabel] ?? 'bg-slate-100'
        }`}
      >
        {slotLabel}
      </span>

      <div className="min-w-0 flex-1 rounded bg-white px-1.5 py-0.5">
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
              className="block w-full text-left font-medium text-slate-900 hover:text-red-600 hover:underline"
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

        {player && pricePaid !== null && (
          <div className="mt-0.5 flex items-center justify-between text-xs text-slate-500">
            <span>Bye {player.byeWeek ?? '—'}</span>

            {isEditing ? (
              <input
                type="number"
                inputMode="decimal"
                step={PRICE_INCREMENT}
                min={MIN_PRICE}
                autoFocus
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                onBlur={() => {
                  if (skipNextBlurRef.current) {
                    skipNextBlurRef.current = false
                    return
                  }
                  commit()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commit()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    cancel()
                  }
                }}
                aria-label={`New price for ${player.name}`}
                className="w-16 rounded border border-slate-300 px-1 py-0.5 text-right font-medium text-slate-700"
              />
            ) : (
              <span className="flex items-center gap-1">
                <span className="font-medium text-slate-700">${pricePaid.toFixed(2)}</span>
                <button
                  type="button"
                  onClick={startEditing}
                  aria-label={`Edit price for ${player.name}`}
                  className="leading-none text-slate-400 hover:text-slate-600"
                >
                  ✎
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default RosterSlot
