// Owns DraftSession state: selected league format, budget, and the
// kicker/defense toggles. This is the frontend-only session state from
// CLAUDE.md's Session Isolation section — it never touches services/ or
// the server, and never persists beyond this browser session (see
// docs/datamodel.md's "Frontend-only / session state").

import { useState } from 'react'
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
  const [leagueFormatId, setLeagueFormatId] = useState<LeagueFormatKey | null>(null)
  const [budget, setBudget] = useState<number | null>(null)
  const [kickerEnabled, setKickerEnabled] = useState(true)
  const [defenseEnabled, setDefenseEnabled] = useState(true)

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
