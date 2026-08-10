// Top-level state-driven switch between Setup and Draft (no router needed
// for two screens, per CLAUDE.md's Frontend Structure notes). The three
// session hooks are instantiated once here, so Setup and Draft share the
// same state instances rather than each owning their own.

import { useMemo, useState } from 'react'
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
  const [currentPage, setCurrentPage] = useState<CurrentPage>('setup')
  const draftSession = useDraftSession()

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
