// Owns the list of up to MAX_SAVED_ROSTERS SavedRoster snapshots
// (docs/saved_rosters_plan.md), persisted to localStorage under its own
// key — entirely separate from sessionPersistence.ts's "draftSession" blob,
// and deliberately localStorage rather than sessionStorage, since a saved
// roster must survive closing the tab/browser (see App.tsx's Storage
// verification note / CLAUDE.md's Session Isolation section). Enforcing the
// cap of 6 is left to the caller (Draft.tsx decides whether to call saveNew
// or overwrite based on isAtCap) — this hook does not block a 7th save on
// its own, matching the plan's "doesn't block, opens a picker instead".

import { useCallback, useState } from 'react'
import type { SavedRoster, SavedRosterAssignment } from '../types/Roster'

const STORAGE_KEY = 'savedRosters'
export const MAX_SAVED_ROSTERS = 6

function isValidSavedRosterAssignment(value: unknown): value is SavedRosterAssignment {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.slotLabel === 'string' &&
    typeof v.slotInstanceId === 'string' &&
    typeof v.playerId === 'string' &&
    typeof v.playerName === 'string' &&
    typeof v.playerTeam === 'string' &&
    typeof v.playerPosition === 'string' &&
    typeof v.pricePaid === 'number'
  )
}

function isValidSavedRoster(value: unknown): value is SavedRoster {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.savedAt === 'string' &&
    typeof v.leagueFormatKey === 'string' &&
    typeof v.budget === 'number' &&
    typeof v.defenseEnabled === 'boolean' &&
    typeof v.kickerEnabled === 'boolean' &&
    typeof v.totalSpent === 'number' &&
    typeof v.remainingBudget === 'number' &&
    Array.isArray(v.assignments) &&
    v.assignments.every(isValidSavedRosterAssignment)
  )
}

// A corrupted/unparseable blob or a top-level shape mismatch falls back to
// an empty list, same "never crash the app over an optional enhancement"
// rule sessionPersistence.ts follows for the draft session.
export function readSavedRosters(): SavedRoster[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidSavedRoster)
  } catch {
    return []
  }
}

function writeSavedRosters(rosters: SavedRoster[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rosters))
  } catch {
    // Swallowed — private browsing / storage quota shouldn't crash the app
    // over what's an optional enhancement, same as sessionPersistence.ts.
  }
}

// Pure array operations, kept separate from the React state wiring below so
// the actual save-list rules are directly unit-testable without rendering a
// hook — same split useRoster.ts uses for removeAssignment/clearAllAssignments.

export function addSavedRoster(rosters: SavedRoster[], entry: SavedRoster): SavedRoster[] {
  return [...rosters, entry]
}

// No-op if id isn't found, mirroring updateAssignmentPrice's no-op-on-unknown-id
// behavior in useRoster.ts, rather than throwing.
export function overwriteSavedRoster(rosters: SavedRoster[], id: string, entry: SavedRoster): SavedRoster[] {
  return rosters.map((existing) => (existing.id === id ? entry : existing))
}

export function removeSavedRoster(rosters: SavedRoster[], id: string): SavedRoster[] {
  return rosters.filter((existing) => existing.id !== id)
}

// SavedRosterCard's rename flow — updates only the name field, in place;
// savedAt/assignments/everything else about the snapshot is untouched,
// since renaming isn't re-saving the roster. No-op if id isn't found, same
// convention as overwriteSavedRoster above.
export function updateSavedRosterName(rosters: SavedRoster[], id: string, newName: string): SavedRoster[] {
  return rosters.map((existing) => (existing.id === id ? { ...existing, name: newName } : existing))
}

// Save dialog's name field starts empty (a placeholder, not a pre-filled
// default — see SaveRosterDialog.tsx) so a blank submit needs its own
// fallback: use defaultName ("Draft — {date}"), but disambiguate against
// existingNames so two same-day blank saves never collide, e.g.
// "Draft — 8/14/2026 (2)". existingNames should exclude the entry currently
// being overwritten, if any — replacing a save with its own unchanged
// default name isn't a real collision.
export function resolveSaveName(rawName: string, defaultName: string, existingNames: string[]): string {
  const trimmed = rawName.trim()
  if (trimmed !== '') return trimmed

  if (!existingNames.includes(defaultName)) return defaultName

  let suffix = 2
  while (existingNames.includes(`${defaultName} (${suffix})`)) {
    suffix += 1
  }
  return `${defaultName} (${suffix})`
}

export type NewSavedRosterInput = Omit<SavedRoster, 'id' | 'savedAt'>

export interface UseSavedRostersResult {
  savedRosters: SavedRoster[]
  isAtCap: boolean
  saveNew: (roster: NewSavedRosterInput) => void
  overwrite: (id: string, roster: NewSavedRosterInput) => void
  deleteSavedRoster: (id: string) => void
  renameSavedRoster: (id: string, newName: string) => void
}

export function useSavedRosters(): UseSavedRostersResult {
  const [savedRosters, setSavedRosters] = useState<SavedRoster[]>(() => readSavedRosters())

  const persist = useCallback((next: SavedRoster[]) => {
    setSavedRosters(next)
    writeSavedRosters(next)
  }, [])

  const saveNew = useCallback(
    (roster: NewSavedRosterInput) => {
      const entry: SavedRoster = { ...roster, id: crypto.randomUUID(), savedAt: new Date().toISOString() }
      persist(addSavedRoster(savedRosters, entry))
    },
    [savedRosters, persist],
  )

  const overwrite = useCallback(
    (id: string, roster: NewSavedRosterInput) => {
      const entry: SavedRoster = { ...roster, id, savedAt: new Date().toISOString() }
      persist(overwriteSavedRoster(savedRosters, id, entry))
    },
    [savedRosters, persist],
  )

  const deleteSavedRoster = useCallback(
    (id: string) => {
      persist(removeSavedRoster(savedRosters, id))
    },
    [savedRosters, persist],
  )

  const renameSavedRoster = useCallback(
    (id: string, newName: string) => {
      persist(updateSavedRosterName(savedRosters, id, newName))
    },
    [savedRosters, persist],
  )

  return {
    savedRosters,
    isAtCap: savedRosters.length >= MAX_SAVED_ROSTERS,
    saveNew,
    overwrite,
    deleteSavedRoster,
    renameSavedRoster,
  }
}
