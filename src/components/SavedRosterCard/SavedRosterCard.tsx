// One saved-roster summary card for the Saved Rosters page grid — name,
// format, saved date, budget summary, and its full player list (all from
// SavedRoster's own denormalized fields, so this never needs the live
// player pool). Delete is a request up to the page, which owns the single
// shared ConfirmDialog (see SavedRosters.tsx) rather than each card owning
// its own, since only one can ever be open at a time.
//
// Player list order: matches the Draft page's Roster component (QB, RB,
// RB, WR, WR, TE, FLEX, DST, then BENCH), not the order players were
// originally drafted in — via sortSavedRosterAssignments, which reuses the
// same getActiveSlots/getSlotInstanceIds ordering Roster.tsx itself uses,
// rather than a second independent sort. Needs the saved format's slots
// (passed down from SavedRosters.tsx, which has `formats` already) since
// SavedRoster only stores the format's key, not its slot config.

import { sortSavedRosterAssignments } from '../../utils/savedRoster'
import { SLOT_BADGE_TINTS } from '../positionColors'
import type { SavedRoster } from '../../types/Roster'
import type { RosterPositionSlot } from '../../types/League'

interface SavedRosterCardProps {
  savedRoster: SavedRoster
  formatDisplayName: string
  slots: RosterPositionSlot[]
  onResume: () => void
  onRequestDelete: () => void
}

function SavedRosterCard({ savedRoster, formatDisplayName, slots, onResume, onRequestDelete }: SavedRosterCardProps) {
  const savedDate = new Date(savedRoster.savedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const remainingColor = savedRoster.remainingBudget < 0 ? 'text-red-600' : 'text-green-600'
  const orderedAssignments = sortSavedRosterAssignments(savedRoster.assignments, slots, {
    kickerEnabled: savedRoster.kickerEnabled,
    defenseEnabled: savedRoster.defenseEnabled,
  })

  return (
    <section
      aria-label={`Saved roster: ${savedRoster.name}`}
      className="flex flex-col rounded-lg border border-slate-200 bg-parchment p-4 shadow-sm"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-base font-semibold text-slate-900">{savedRoster.name}</h3>
        <button
          type="button"
          onClick={onRequestDelete}
          aria-label={`Delete ${savedRoster.name}`}
          className="shrink-0 text-slate-400 hover:text-red-600"
        >
          ✕
        </button>
      </div>

      <div className="text-xs text-slate-500">
        {formatDisplayName} · Saved {savedDate}
      </div>

      <div className="mt-2 text-xs text-slate-500">
        <div className="flex gap-x-3">
          <span>
            Budget <span className="font-semibold text-slate-900">${savedRoster.budget.toFixed(2)}</span>
          </span>
          <span>
            Spent <span className="font-semibold text-slate-900">${savedRoster.totalSpent.toFixed(2)}</span>
          </span>
        </div>
        <div className="font-semibold">
          Remaining <span className={`font-bold ${remainingColor}`}>${savedRoster.remainingBudget.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
        {orderedAssignments.map((assignment) => (
          <div
            key={assignment.slotInstanceId}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
          >
            <span
              className={`flex w-12 shrink-0 items-center justify-center rounded text-center font-mono font-semibold text-slate-700 ${
                SLOT_BADGE_TINTS[assignment.slotLabel] ?? 'bg-slate-100'
              }`}
            >
              {assignment.slotLabel}
            </span>
            <span className="min-w-0 flex-1 truncate text-slate-900">{assignment.playerName}</span>
            <span className="shrink-0 font-medium text-slate-700">${assignment.pricePaid.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onResume}
        className="mt-3 rounded-md bg-accent-green px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
      >
        Resume
      </button>
    </section>
  )
}

export default SavedRosterCard
