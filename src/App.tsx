// Top-level state-driven switch between Setup and Draft (no router needed
// for two screens, per CLAUDE.md's Frontend Structure notes). The three
// session hooks are instantiated once here, so Setup and Draft share the
// same state instances rather than each owning their own.

import { useEffect, useMemo, useState } from 'react'
import { getLeagueFormats } from './services/leagueService'
import { useAsyncData } from './hooks/useAsyncData'
import { useDraftSession } from './hooks/useDraftSession'
import { useRoster } from './hooks/useRoster'
import { useFavorites } from './hooks/useFavorites'
import { useSavedRosters } from './hooks/useSavedRosters'
import DataStatus from './components/DataStatus/DataStatus'
import ConfirmDialog from './components/ConfirmDialog/ConfirmDialog'
import Setup from './pages/Setup/Setup'
import Draft from './pages/Draft/Draft'
import SavedRosters from './pages/SavedRosters/SavedRosters'
import type { SavedRoster } from './types/Roster'
import type { LeagueFormatKey } from './types/League'

type CurrentPage = 'setup' | 'draft' | 'saved'

// Shared by the initial-page calculation below and the Saved Rosters page's
// "Back" button, so the two can never disagree about what counts as "a
// draft is underway".
function hasActiveDraft(leagueFormatId: string | null, budget: number | null): boolean {
  return leagueFormatId !== null && budget !== null && budget > 0
}

function App() {
  const draftSession = useDraftSession()
  // A rehydrated sessionStorage session (CLAUDE.md's Session Isolation
  // "Optional enhancement") means a mid-draft refresh should land straight
  // on Draft, not send the user back through Setup — the same condition
  // Setup.tsx's own "Start Draft" button already gates on (canStart), just
  // evaluated once up front against whatever useDraftSession restored.
  const [currentPage, setCurrentPage] = useState<CurrentPage>(() =>
    hasActiveDraft(draftSession.leagueFormatId, draftSession.budget) ? 'draft' : 'setup',
  )

  // League formats come from the API now, so this load can fail.
  const { data, status, error } = useAsyncData(getLeagueFormats)
  const formats = useMemo(() => data ?? [], [data])

  const selectedFormat = formats.find((f) => f.key === draftSession.leagueFormatId) ?? null
  const slots = useMemo(() => selectedFormat?.slots ?? [], [selectedFormat])
  const toggles = useMemo(
    () => ({ kickerEnabled: draftSession.kickerEnabled, defenseEnabled: draftSession.defenseEnabled }),
    [draftSession.kickerEnabled, draftSession.defenseEnabled],
  )
  const budget = draftSession.budget ?? 0

  const roster = useRoster({ slots, toggles, budget })
  const favorites = useFavorites()
  const savedRosters = useSavedRosters()

  // Set by handleResume below once the user has confirmed (or there was
  // nothing to confirm), consumed by Draft.tsx's own effect once the player
  // pool it needs to resolve playerIds against has actually loaded — the
  // same "can only run once the async data arrives" shape
  // pruneUnknownPlayers already uses in Draft.tsx.
  const [pendingResume, setPendingResume] = useState<SavedRoster | null>(null)

  // Shared guard for any action that would discard in-progress roster
  // assignments (resuming a save, changing any of Setup's three
  // league-setup controls — see requestSessionChange below). Runs `action`
  // immediately when there's nothing to lose; otherwise routes through the
  // app's normal ConfirmDialog (rendered once, at the bottom of this
  // component) instead of window.confirm(), so it matches the rest of the
  // app's styling instead of a native browser dialog.
  const [confirmAction, setConfirmAction] = useState<{ message: string; run: () => void } | null>(null)

  function requireConfirmIfActiveDraft(message: string, action: () => void) {
    if (roster.assignments.length > 0) {
      setConfirmAction({ message, run: action })
    } else {
      action()
    }
  }

  function performResume(saved: SavedRoster) {
    roster.clearRoster()
    draftSession.setLeagueFormatId(saved.leagueFormatKey)
    draftSession.setBudget(saved.budget)
    draftSession.setKickerEnabled(saved.kickerEnabled)
    draftSession.setDefenseEnabled(saved.defenseEnabled)
    setPendingResume(saved)
    setCurrentPage('draft')
  }

  // Resume flow (docs/saved_rosters_plan.md).
  function handleResume(saved: SavedRoster) {
    requireConfirmIfActiveDraft(
      'Resuming this saved roster will discard your current in-progress draft. Continue?',
      () => performResume(saved),
    )
  }

  // Setup's three league-setup controls (format, budget, kicker/defense
  // toggles) all share this same guard shape: re-picking any of them
  // mid-draft doesn't clear roster.assignments on its own, but the roster
  // was built against the *old* value — a format change orphans old
  // slotInstanceIds against the new format's slots, a budget change makes
  // remaining recompute against a budget the roster was never drafted
  // toward, and a toggle change can orphan a K/DST slot the same way a
  // format change orphans any other slot. Clearing first keeps the roster
  // in sync with whichever value the user actually lands on.
  //
  // One shared, generic message across all three (not "changing format
  // will..." vs "changing budget will...") since the consequence and the
  // condition are identical regardless of which control triggered it.
  //
  // No separate "already confirmed this visit" tracking needed: since the
  // guard condition is just the live roster.assignments.length check,
  // confirming on any one control clears the roster via `apply` below,
  // which makes that same check naturally pass silently for the other two
  // controls (or repeated changes to the same one) for the rest of the
  // visit — falls out of sharing one clearRoster() call, nothing extra to
  // track.
  //
  // This guards the actual draftSession setters, not any particular
  // button/input — so it's entry-point-agnostic: today only Setup's own
  // controls call it, but any future UI that changes these values mid-draft
  // is covered too.
  function requestSessionChange<T>(currentValue: T, newValue: T, apply: (value: T) => void) {
    if (newValue === currentValue) return
    requireConfirmIfActiveDraft('Changing this will clear your current in-progress roster. Continue?', () => {
      roster.clearRoster()
      apply(newValue)
    })
  }

  const handleRequestFormatChange = (newFormatId: LeagueFormatKey) =>
    requestSessionChange(draftSession.leagueFormatId, newFormatId, draftSession.setLeagueFormatId)

  const handleRequestBudgetChange = (newBudget: number | null) =>
    requestSessionChange(draftSession.budget, newBudget, draftSession.setBudget)

  const handleRequestKickerChange = (enabled: boolean) =>
    requestSessionChange(draftSession.kickerEnabled, enabled, draftSession.setKickerEnabled)

  const handleRequestDefenseChange = (enabled: boolean) =>
    requestSessionChange(draftSession.defenseEnabled, enabled, draftSession.setDefenseEnabled)

  // A rehydrated leagueFormatId can reference a format that no longer
  // exists once the real list loads (e.g. a format was renamed/removed
  // server-side between sessions) — only checkable here, once `formats`
  // actually arrives, not synchronously at hook-mount time. Falls back to a
  // fresh Setup screen rather than rendering Draft with an empty slot list.
  useEffect(() => {
    if (status !== 'ready') return
    if (draftSession.leagueFormatId === null) return
    const formatStillExists = formats.some((format) => format.key === draftSession.leagueFormatId)
    if (!formatStillExists) {
      draftSession.setLeagueFormatId(null)
      setCurrentPage('setup')
    }
  }, [status, formats, draftSession.leagueFormatId, draftSession.setLeagueFormatId])

  // After every hook, so hook order stays stable across renders. Without
  // formats there is no league to set up, so this replaces the page rather
  // than rendering an empty selector.
  if (status !== 'ready') {
    return (
      <div className="flex w-full justify-center p-6">
        <div className="w-full max-w-xl">
          <DataStatus status={status} loadingLabel="Loading league formats…" error={error} />
        </div>
      </div>
    )
  }

  // Resume (from Setup or Saved Rosters) and the format-change guard (from
  // Setup) can each need the shared ConfirmDialog below regardless of which
  // page is current, so page content is picked once here and the dialog is
  // rendered alongside it in a single final return, rather than as a
  // separate early return per page.
  let pageContent
  if (currentPage === 'setup') {
    pageContent = (
      <Setup
        formats={formats}
        draftSession={draftSession}
        onStartDraft={() => setCurrentPage('draft')}
        onViewSavedRosters={() => setCurrentPage('saved')}
        onRequestFormatChange={handleRequestFormatChange}
        onRequestBudgetChange={handleRequestBudgetChange}
        onRequestKickerChange={handleRequestKickerChange}
        onRequestDefenseChange={handleRequestDefenseChange}
      />
    )
  } else if (currentPage === 'saved') {
    pageContent = (
      <SavedRosters
        savedRosters={savedRosters.savedRosters}
        formats={formats}
        onResume={handleResume}
        onDelete={savedRosters.deleteSavedRoster}
        onBack={() =>
          setCurrentPage(hasActiveDraft(draftSession.leagueFormatId, draftSession.budget) ? 'draft' : 'setup')
        }
      />
    )
  } else {
    pageContent = (
      <Draft
        slots={slots}
        toggles={toggles}
        budget={budget}
        leagueFormatKey={draftSession.leagueFormatId as LeagueFormatKey}
        formats={formats}
        roster={roster}
        favorites={favorites}
        savedRosters={savedRosters}
        pendingResume={pendingResume}
        onResumeHydrated={() => setPendingResume(null)}
        onViewSavedRosters={() => setCurrentPage('saved')}
        onGoToSetup={() => setCurrentPage('setup')}
      />
    )
  }

  return (
    <>
      {pageContent}
      <ConfirmDialog
        open={confirmAction !== null}
        title="Confirm"
        message={confirmAction?.message ?? ''}
        confirmLabel="Continue"
        cancelLabel="Cancel"
        onConfirm={() => {
          confirmAction?.run()
          setConfirmAction(null)
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  )
}

export default App
