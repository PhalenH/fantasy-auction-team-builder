// Third page (docs/saved_rosters_plan.md): a grid of up to MAX_SAVED_ROSTERS
// SavedRosterCards, each fully self-rendering from its own denormalized
// data — this page never needs the live player pool. State-driven
// conditional rendering like Setup/Draft (see App.tsx), not a router.

import { useState } from 'react'
import SavedRosterCard from '../../components/SavedRosterCard/SavedRosterCard'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import FloatingDots from '../../components/FloatingDots/FloatingDots'
import { resolveSaveName } from '../../hooks/useSavedRosters'
import type { SavedRoster } from '../../types/Roster'
import type { LeagueFormatWithSlots } from '../../types/League'

interface SavedRostersProps {
  savedRosters: SavedRoster[]
  formats: LeagueFormatWithSlots[]
  onResume: (saved: SavedRoster) => void
  onDelete: (id: string) => void
  onRename: (id: string, newName: string) => void
  onBack: () => void
  /**
   * Plain navigation to Setup — same destination and same "Draft Setup"
   * label as the Draft page's own button (see Draft.tsx). No confirm/guard
   * here: that protection lives on Setup's own format/budget/toggle change
   * handlers (App.tsx's requestSessionChange), so it applies automatically
   * no matter which page someone reached Setup from.
   */
  onGoToSetup: () => void
}

function SavedRosters({ savedRosters, formats, onResume, onDelete, onRename, onBack, onGoToSetup }: SavedRostersProps) {
  // One shared confirm dialog for the whole grid (which card is pending
  // deletion), rather than each SavedRosterCard owning its own — only one
  // can ever be open at a time, same reasoning PlayerList's single
  // clear-roster ConfirmDialog follows.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const pendingDelete = savedRosters.find((r) => r.id === pendingDeleteId) ?? null

  function handleConfirmDelete() {
    if (pendingDeleteId) onDelete(pendingDeleteId)
    setPendingDeleteId(null)
  }

  return (
    // relative + overflow-hidden here is what FloatingDots needs to fill
    // and stay clipped to (see its own header comment) — an experimental
    // ambient decoration, not a background color change: it's just the
    // drifting dots layered on top of the existing bg-page-dark. z-0 is
    // load-bearing, not decorative: position:relative alone does NOT create
    // a stacking context, so without an explicit z-index here too,
    // FloatingDots' negative z-index escapes past this div entirely and
    // lands behind the page's own background instead of behind just this
    // div's content — confirmed by screenshotting a standalone repro of
    // both cases before landing this.
    <div className="relative z-0 min-h-screen w-full overflow-hidden bg-page-dark p-6">
      <FloatingDots />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Saved Rosters</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onGoToSetup}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400"
            >
              Draft Setup
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400"
            >
              Back to Draft
            </button>
          </div>
        </div>

        {savedRosters.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
            No saved rosters yet. Complete a roster on the Draft page and use Save to add one here.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedRosters.map((savedRoster) => {
              const format = formats.find((f) => f.key === savedRoster.leagueFormatKey)
              return (
                <SavedRosterCard
                  key={savedRoster.id}
                  savedRoster={savedRoster}
                  formatDisplayName={format?.displayName ?? savedRoster.leagueFormatKey}
                  slots={format?.slots ?? []}
                  onResume={() => onResume(savedRoster)}
                  onRequestDelete={() => setPendingDeleteId(savedRoster.id)}
                  onRequestRename={(newName) => {
                    // Collision resolution excludes this roster itself —
                    // renaming it back to its own unchanged name isn't a
                    // real collision — same reasoning the Save dialog's
                    // overwrite flow already applies. resolveSaveName only
                    // disambiguates its own blank-input fallback path;
                    // SavedRosterCard already intercepts a blank rename
                    // before this ever fires, so every call here carries a
                    // real (non-blank) typed name and is used as entered.
                    const otherNames = savedRosters.filter((r) => r.id !== savedRoster.id).map((r) => r.name)
                    const resolvedName = resolveSaveName(newName, savedRoster.name, otherNames)
                    onRename(savedRoster.id, resolvedName)
                  }}
                />
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Confirm"
        message={pendingDelete ? `Delete "${pendingDelete.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  )
}

export default SavedRosters
