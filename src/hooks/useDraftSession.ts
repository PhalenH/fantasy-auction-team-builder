// Owns DraftSession state: selected league format, budget, and the
// kicker/defense toggles. This is the frontend-only session state from
// CLAUDE.md's Session Isolation section — it never touches services/ or
// the server. It's mirrored into sessionStorage (the section's "Optional
// enhancement") purely so a page refresh doesn't lose it; sessionStorage is
// still per-tab and clears on tab/browser close, so this remains session
// state, not a durable server-side record.

import { useEffect, useRef, useState } from 'react'
import { readPersistedSession, writePersistedSessionSlice, type PersistedSession } from './sessionPersistence'
import type { LeagueFormatKey } from '../types/League'

export interface UseDraftSessionResult {
  leagueFormatId: LeagueFormatKey | null
  setLeagueFormatId: (leagueFormatId: LeagueFormatKey | null) => void
  budget: number | null
  setBudget: (budget: number | null) => void
  kickerEnabled: boolean
  setKickerEnabled: (enabled: boolean) => void
  defenseEnabled: boolean
  setDefenseEnabled: (enabled: boolean) => void
}

export function useDraftSession(): UseDraftSessionResult {
  // A ref (not module scope) so each hook instance re-reads sessionStorage
  // at its own mount time, rather than freezing whatever the first import
  // saw — matters for tests, which mount a fresh App per test but share one
  // module cache. Read once per mount, not once per field.
  const persistedRef = useRef<PersistedSession | null | undefined>(undefined)
  if (persistedRef.current === undefined) {
    persistedRef.current = readPersistedSession()
  }
  const persisted = persistedRef.current

  // Cast: sessionPersistence only knows leagueFormatId as a plain string
  // (it has no dependency on the frontend's LeagueFormatKey union). An
  // invalid/stale key is caught later once the real format list loads from
  // the API — see App.tsx's format-validity check — the same deferred
  // pattern useRoster's player-pool pruning uses for stale playerIds.
  const [leagueFormatId, setLeagueFormatId] = useState<LeagueFormatKey | null>(
    (persisted?.leagueFormatId as LeagueFormatKey | null) ?? null,
  )
  const [budget, setBudget] = useState<number | null>(persisted?.budget ?? null)
  const [kickerEnabled, setKickerEnabled] = useState(persisted?.kickerEnabled ?? true)
  const [defenseEnabled, setDefenseEnabled] = useState(persisted?.defenseEnabled ?? true)

  useEffect(() => {
    writePersistedSessionSlice({ leagueFormatId, budget, kickerEnabled, defenseEnabled })
  }, [leagueFormatId, budget, kickerEnabled, defenseEnabled])

  return {
    leagueFormatId,
    setLeagueFormatId,
    budget,
    setBudget,
    kickerEnabled,
    setKickerEnabled,
    defenseEnabled,
    setDefenseEnabled,
  }
}
