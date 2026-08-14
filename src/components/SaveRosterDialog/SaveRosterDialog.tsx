// Save flow modal for the Draft page's Save button (docs/saved_rosters_plan.md).
// Two modes:
//   - 'new': under the cap of 6 — a name field, starting empty (placeholder
//     only, not pre-filled — see the name input below) so a blank submit
//     can't silently reuse an identical auto-generated default across two
//     saves. A blank submit falls back to that default via
//     resolveSaveName(), called by the caller (Draft.tsx) which owns the
//     existing-saves list resolveSaveName needs for collision-checking —
//     this dialog only ever passes through the raw (possibly empty) name.
//   - 'overwrite': already at the cap — pick one of the 6 existing saves to
//     replace, with its name pre-filled as an editable rename (a
//     deliberate convenience, unrelated to the blank-default problem above
//     since it's pre-filled with a real, already-unique existing name).
// A custom modal (not window.confirm()/window.prompt()) so both the
// overwrite picker's list-selection and the rename text field are directly
// testable via RTL, consistent with ConfirmDialog already being the app's
// established alternative to native dialogs for this kind of flow. The
// separate resume-time "you have unsaved progress" check goes through
// ConfirmDialog directly instead (see App.tsx) rather than this component.

import { useEffect, useState } from 'react'
import type { SavedRoster } from '../../types/Roster'
import type { LeagueFormatWithSlots } from '../../types/League'

const NAME_PLACEHOLDER = 'e.g. Draft 8/6 or Hero RB build'

interface SaveRosterDialogProps {
  open: boolean
  mode: 'new' | 'overwrite'
  existingRosters: SavedRoster[]
  formats: LeagueFormatWithSlots[]
  onCancel: () => void
  /**
   * name is the raw (possibly empty, untrimmed) value from the input —
   * resolving it to a final name (trim, fall back to a default, disambiguate
   * a collision) is Draft.tsx's job, not this component's.
   */
  onSave: (name: string, overwriteId: string | null, clearAfterSave: boolean) => void
}

function SaveRosterDialog({ open, mode, existingRosters, formats, onCancel, onSave }: SaveRosterDialogProps) {
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Re-initialize every time the dialog opens, rather than carrying stale
  // state from a prior open — mirrors ConfirmDialog's open-gated rendering.
  // Starts blank in both modes; 'overwrite' fills it in once a save is
  // picked (see handleSelect below), not up front.
  useEffect(() => {
    if (!open) return
    setName('')
    setSelectedId(null)
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  // A blank name is valid now (it means "use the auto-generated default" —
  // see the header comment), so only 'overwrite' mode has anything left to
  // require: a target must be picked before Save/Save-and-clear can fire.
  const canSave = mode === 'new' ? true : selectedId !== null

  function handleSelect(roster: SavedRoster) {
    setSelectedId(roster.id)
    setName(roster.name)
  }

  function handleSave(clearAfterSave: boolean) {
    if (!canSave) return
    onSave(name, mode === 'overwrite' ? selectedId : null, clearAfterSave)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-roster-dialog-title"
        className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg"
      >
        <div className="px-4 pb-3 pt-5">
          <h2 id="save-roster-dialog-title" className="text-center text-base font-bold text-slate-900">
            {mode === 'new' ? 'Save Roster' : 'Choose a Save to Replace'}
          </h2>

          {mode === 'overwrite' && (
            <>
              <p className="mt-1 text-center text-sm text-slate-500">
                You already have {existingRosters.length} saved rosters. Pick one to overwrite.
              </p>
              <div role="radiogroup" aria-label="Saved rosters" className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
                {existingRosters.map((roster) => {
                  const formatDisplayName =
                    formats.find((f) => f.key === roster.leagueFormatKey)?.displayName ?? roster.leagueFormatKey
                  return (
                    <button
                      key={roster.id}
                      type="button"
                      role="radio"
                      aria-checked={selectedId === roster.id}
                      onClick={() => handleSelect(roster)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        selectedId === roster.id
                          ? 'border-accent-green bg-green-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-medium text-slate-900">{roster.name}</div>
                      <div className="text-xs text-slate-500">
                        {formatDisplayName} · {new Date(roster.savedAt).toLocaleDateString()} · $
                        {roster.totalSpent.toFixed(2)} spent
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <div className="mt-3">
            <label htmlFor="save-roster-name" className="mb-1 block text-xs font-semibold text-slate-700">
              {mode === 'new' ? 'Name' : 'Rename (optional)'}
            </label>
            <input
              id="save-roster-name"
              type="text"
              value={name}
              placeholder={NAME_PLACEHOLDER}
              disabled={mode === 'overwrite' && selectedId === null}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100"
            />
          </div>
        </div>

        <div className="flex divide-x divide-slate-200 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={!canSave}
            className="flex-1 py-3 text-sm font-semibold text-accent-green hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Save
          </button>
        </div>

        {/* Below the Cancel/Save row and visually secondary (border-t,
            smaller/muted text) — this saves too, but shouldn't compete with
            Save as if it were an equally-weighted second primary action. */}
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={!canSave}
          className="w-full border-t border-slate-200 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          Save and clear current roster
        </button>
      </div>
    </div>
  )
}

export default SaveRosterDialog
