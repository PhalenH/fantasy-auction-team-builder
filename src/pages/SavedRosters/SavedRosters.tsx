// Third page (docs/saved_rosters_plan.md): a grid of up to MAX_SAVED_ROSTERS
// SavedRosterCards, each fully self-rendering from its own denormalized
// data — this page never needs the live player pool. State-driven
// conditional rendering like Setup/Draft (see App.tsx), not a router.

import { useState } from 'react'
import SavedRosterCard from '../../components/SavedRosterCard/SavedRosterCard'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import type { SavedRoster } from '../../types/Roster'
import type { LeagueFormatWithSlots } from '../../types/League'

interface SavedRostersProps {
  savedRosters: SavedRoster[]
  formats: LeagueFormatWithSlots[]
  onResume: (saved: SavedRoster) => void
  onDelete: (id: string) => void
  onBack: () => void
}

function SavedRosters({ savedRosters, formats, onResume, onDelete, onBack }: SavedRostersProps) {
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
    <div className="min-h-screen w-full bg-page-dark p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Saved Rosters</h1>
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400"
          >
            Back to Draft
          </button>
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
