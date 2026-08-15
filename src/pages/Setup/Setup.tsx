// Choose league format, kicker/defense toggles, and budget, then hand off
// to the Draft page. Budget presets are UI-only constants here, per
// docs/datamodel.md's "Budget presets" section — not modeled data.

import { useEffect, useState } from 'react'
import LeagueSelector from '../../components/LeagueSelector/LeagueSelector'
import NewsTicker from '../../components/NewsTicker/NewsTicker'
import type { LeagueFormatKey, LeagueFormatWithSlots } from '../../types/League'
import type { UseDraftSessionResult } from '../../hooks/useDraftSession'

const BUDGET_PRESETS = [150, 200, 250, 300]

interface SetupProps {
  formats: LeagueFormatWithSlots[]
  draftSession: UseDraftSessionResult
  onStartDraft: () => void
  onViewSavedRosters: () => void
  /**
   * App.tsx's guarded setters for all three league-setup controls — routed
   * through here instead of calling draftSession's setters directly, since
   * changing any of them mid-draft can leave the roster's existing
   * assignments out of sync with the new value (a format change orphans old
   * slotInstanceIds, a budget change makes remaining recompute against a
   * budget the roster wasn't drafted toward, a toggle change can orphan a
   * K/DST slot the same way a format change orphans any other slot) — so
   * all three get the same "this will clear your roster" confirm the resume
   * flow uses. See App.tsx's requestSessionChange.
   */
  onRequestFormatChange: (formatId: LeagueFormatKey) => void
  onRequestBudgetChange: (budget: number | null) => void
  onRequestKickerChange: (enabled: boolean) => void
  onRequestDefenseChange: (enabled: boolean) => void
  /**
   * The same live roster.assignments.length > 0 check already driving the
   * format/budget/toggle mid-draft guard (App.tsx's requireConfirmIfActiveDraft)
   * — reused here purely for the primary button's label, not a separate
   * flag to keep in sync. It falls back to "Start Draft" for free the
   * instant a guarded change is confirmed and clearRoster() runs, the same
   * way the guard's own no-op check does.
   */
  hasInProgressRoster: boolean
}

function Setup({
  formats,
  draftSession,
  onStartDraft,
  onViewSavedRosters,
  onRequestFormatChange,
  onRequestBudgetChange,
  onRequestKickerChange,
  onRequestDefenseChange,
  hasInProgressRoster,
}: SetupProps) {
  const { leagueFormatId, budget, kickerEnabled, defenseEnabled } = draftSession

  const canStart = leagueFormatId !== null && budget !== null && budget > 0
  const isCustomBudget = budget !== null && !BUDGET_PRESETS.includes(budget)

  // Custom budget field commits on blur/Enter, not per keystroke, so typing
  // doesn't fire the mid-draft "this will clear your roster" guard
  // (App.tsx's requestSessionChange) on every character — only the preset
  // buttons remain a single discrete click-to-guard action, since a click
  // is already one committed choice, not a typing sequence.
  //
  // Local text state mirrors RosterSlot's price-editing pattern: keystrokes
  // only ever update this, never draftSession directly. Synced back from
  // the committed budget (via the effect below) whenever it changes from
  // outside this input — a preset click, a resumed session, sessionStorage
  // rehydration on refresh — so the field doesn't drift from what's
  // actually committed.
  const [customBudgetText, setCustomBudgetText] = useState(() => (isCustomBudget ? String(budget) : ''))

  useEffect(() => {
    setCustomBudgetText(isCustomBudget ? String(budget) : '')
  }, [isCustomBudget, budget])

  // Same parse the field always used (empty -> null, otherwise Number()) —
  // just applied at commit time now instead of on every keystroke.
  function commitCustomBudget() {
    // What the field would show if it were freshly synced from the
    // committed budget right now — i.e. "" whenever a preset is active,
    // per the display rule below. If the field already reads exactly this
    // (nothing typed, or a prior revert already put it back here — see the
    // end of this function), there is nothing to commit: bail out before
    // even parsing, rather than reparsing blank text as "clear the budget
    // to null" just because a preset happens to display as blank here.
    // Without this, a redundant blur after a cancelled commit would
    // reparse that blank display as a *new* change request and re-open the
    // guard — even though nothing about the committed budget ever changed.
    const currentDisplay = isCustomBudget ? String(budget) : ''
    if (customBudgetText === currentDisplay) return

    onRequestBudgetChange(customBudgetText.trim() === '' ? null : Number(customBudgetText))

    // Revert the displayed text back to whatever's actually committed right
    // now (budget/isCustomBudget, still the pre-commit values in this
    // closure). If onRequestBudgetChange applied immediately, the sync
    // effect above fires right after and overwrites this with the *new*
    // committed value once that prop actually lands — so this line only
    // "sticks" when the guard deferred the change behind ConfirmDialog
    // (App.tsx's requireConfirmIfActiveDraft). Cancelling there never
    // touches `budget`, so there's no prop change left to resync from, and
    // this is what puts the rejected typed value back to the real
    // committed one instead of leaving it displayed.
    setCustomBudgetText(currentDisplay)
  }

  return (
    // flex-col so the ticker sits above the card in normal document flow
    // (not sticky/fixed) as its own full-width strip, rather than beside it
    // in the same row — the card-centering flex/padding that used to live
    // on this outer div moved to the inner wrapper below so the ticker
    // itself can span edge-to-edge with no page padding.
    <div className="flex min-h-screen w-full flex-col bg-page-dark">
      <NewsTicker />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Set Up Your Draft</h1>
            <button
              type="button"
              onClick={onViewSavedRosters}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400"
            >
              Saved Rosters
            </button>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">League Format</h2>
            <LeagueSelector
              formats={formats}
              selectedFormatId={leagueFormatId}
              onSelect={onRequestFormatChange}
            />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Roster Extras</h2>
            <label className="mr-4 inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={kickerEnabled}
                onChange={(event) => onRequestKickerChange(event.target.checked)}
                className="accent-accent-green"
              />
              Kicker
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={defenseEnabled}
                onChange={(event) => onRequestDefenseChange(event.target.checked)}
                className="accent-accent-green"
              />
              Defense/Special Teams
            </label>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Auction Budget</h2>
            <div className="flex flex-wrap items-center gap-2">
              {BUDGET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onRequestBudgetChange(preset)}
                  aria-pressed={budget === preset}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    budget === preset
                      ? 'border-accent-green bg-accent-green text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  ${preset}
                </button>
              ))}
              <input
                type="number"
                min={1}
                placeholder="Custom"
                value={customBudgetText}
                onChange={(event) => setCustomBudgetText(event.target.value)}
                onBlur={commitCustomBudget}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitCustomBudget()
                  }
                }}
                className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                aria-label="Custom budget amount"
              />
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              disabled={!canStart}
              onClick={onStartDraft}
              className="rounded-md bg-accent-green px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {hasInProgressRoster ? 'Resume Draft' : 'Start Draft'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Setup
