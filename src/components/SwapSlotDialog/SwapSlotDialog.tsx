// Manual move/swap picker (RosterSlot's ⇄ icon) — lists every roster slot
// the tapped player could legally move or swap into (see
// utils/rosterAssignment.ts's getSwapTargets, which Roster.tsx calls to
// build `targets`; this component only renders whatever list it's given).
//
// Visually matches the app's existing modal/list-picker pattern (compare
// SaveRosterDialog's overwrite picker) — centered card, scrollable list,
// Cancel footer — but deliberately isn't built on that same
// role="radiogroup"/role="radio" pattern: picking a save-overwrite target
// is a staged selection (pick, then a separate Save button confirms it),
// while tapping a row here *is* the action — it moves/swaps immediately and
// closes. That's a plain list of buttons, not a form control, so each row
// is just a <button> rather than a radio.

import { useEffect } from 'react'

export interface SwapSlotDialogTarget {
  slotInstanceId: string
  slotLabel: string
  /** The player currently occupying this slot, or null if it's empty. */
  occupant: { name: string; pricePaid: number } | null
}

interface SwapSlotDialogProps {
  open: boolean
  playerName: string
  targets: SwapSlotDialogTarget[]
  onSelect: (targetSlotInstanceId: string) => void
  onCancel: () => void
}

function SwapSlotDialog({ open, playerName, targets, onSelect, onCancel }: SwapSlotDialogProps) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-slot-dialog-title"
        className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg"
      >
        <div className="px-4 pb-3 pt-5">
          <h2 id="swap-slot-dialog-title" className="text-center text-base font-bold text-slate-900">
            Move {playerName}
          </h2>

          {targets.length === 0 ? (
            <p className="mt-2 text-center text-sm text-slate-500">No eligible slots to move to.</p>
          ) : (
            <div aria-label="Target roster slot" className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
              {targets.map((target) => (
                <button
                  key={target.slotInstanceId}
                  type="button"
                  onClick={() => onSelect(target.slotInstanceId)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">
                    {target.slotLabel} —{' '}
                    {target.occupant ? `${target.occupant.name} ($${target.occupant.pricePaid.toFixed(2)})` : 'empty'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default SwapSlotDialog
