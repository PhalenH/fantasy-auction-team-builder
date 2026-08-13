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
import DataStatus from './components/DataStatus/DataStatus'
import Setup from './pages/Setup/Setup'
import Draft from './pages/Draft/Draft'

type CurrentPage = 'setup' | 'draft'

function App() {
  const draftSession = useDraftSession()
  // A rehydrated sessionStorage session (CLAUDE.md's Session Isolation
  // "Optional enhancement") means a mid-draft refresh should land straight
  // on Draft, not send the user back through Setup — the same condition
  // Setup.tsx's own "Start Draft" button already gates on (canStart), just
  // evaluated once up front against whatever useDraftSession restored.
  const [currentPage, setCurrentPage] = useState<CurrentPage>(() =>
    draftSession.leagueFormatId !== null && draftSession.budget !== null && draftSession.budget > 0
      ? 'draft'
      : 'setup',
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

  if (currentPage === 'setup') {
    return (
      <Setup formats={formats} draftSession={draftSession} onStartDraft={() => setCurrentPage('draft')} />
    )
  }

  return <Draft slots={slots} toggles={toggles} budget={budget} roster={roster} favorites={favorites} />
}

export default App
