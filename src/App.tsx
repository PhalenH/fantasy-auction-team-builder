// Top-level state-driven switch between Setup and Draft (no router needed
// for two screens, per CLAUDE.md's Frontend Structure notes). The three
// session hooks are instantiated once here, so Setup and Draft share the
// same state instances rather than each owning their own.

import { useEffect, useMemo, useState } from 'react'
import { getLeagueFormats } from './services/leagueService'
import { useDraftSession } from './hooks/useDraftSession'
import { useRoster } from './hooks/useRoster'
import { useFavorites } from './hooks/useFavorites'
import Setup from './pages/Setup/Setup'
import Draft from './pages/Draft/Draft'
import type { LeagueFormatWithSlots } from './types/League'

type CurrentPage = 'setup' | 'draft'

function App() {
  const [currentPage, setCurrentPage] = useState<CurrentPage>('setup')
  const [formats, setFormats] = useState<LeagueFormatWithSlots[]>([])
  const draftSession = useDraftSession()

  useEffect(() => {
    getLeagueFormats().then(setFormats)
  }, [])

  const selectedFormat = formats.find((f) => f.key === draftSession.leagueFormatId) ?? null
  const slots = useMemo(() => selectedFormat?.slots ?? [], [selectedFormat])
  const toggles = useMemo(
    () => ({ kickerEnabled: draftSession.kickerEnabled, defenseEnabled: draftSession.defenseEnabled }),
    [draftSession.kickerEnabled, draftSession.defenseEnabled],
  )
  const budget = draftSession.budget ?? 0

  const roster = useRoster({ slots, toggles, budget })
  const favorites = useFavorites()

  if (currentPage === 'setup') {
    return (
      <Setup formats={formats} draftSession={draftSession} onStartDraft={() => setCurrentPage('draft')} />
    )
  }

  return <Draft slots={slots} toggles={toggles} budget={budget} roster={roster} favorites={favorites} />
}

export default App
