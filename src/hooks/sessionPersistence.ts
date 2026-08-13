// Shared low-level read/write for the single sessionStorage blob backing
// the "Optional enhancement" in CLAUDE.md's Session Isolation & State
// Persistence section: draft config, roster assignments, and favorites all
// live under one "draftSession" key (as one JSON object) rather than
// several small keys, since they're always read/written together.
//
// sessionStorage (not localStorage) is deliberate and matches CLAUDE.md
// exactly: per-tab, cleared on tab/browser close — a second tab must start
// fresh, not inherit another tab's in-progress draft.
//
// This module owns only the raw blob shape and its structural validation.
// It does NOT know about currently-valid league format keys or the current
// player pool — those are server-loaded lookups that arrive asynchronously
// (see App.tsx and Draft.tsx), so referential checks against them happen
// there, once that data is available, rather than here.

import type { RosterAssignment } from '../types/Roster'

const STORAGE_KEY = 'draftSession'

export interface PersistedSession {
  leagueFormatId: string | null
  budget: number | null
  kickerEnabled: boolean
  defenseEnabled: boolean
  assignments: RosterAssignment[]
  favoriteIds: string[]
}

function isValidRosterAssignment(value: unknown): value is RosterAssignment {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.slotInstanceId === 'string' &&
    typeof v.playerId === 'string' &&
    typeof v.pricePaid === 'number'
  )
}

// Only the top-level shape is a hard fail (returns null, discarding the
// whole session). Within assignments/favoriteIds, an individual malformed
// entry is dropped rather than invalidating everything else parsed fine
// alongside it — the same "don't let one bad row break the whole
// rehydration" principle CLAUDE.md's task calls for with stale player_ids,
// just applied one step earlier to outright malformed entries too.
function parsePersistedSession(value: unknown): PersistedSession | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>

  if (v.leagueFormatId !== null && typeof v.leagueFormatId !== 'string') return null
  if (v.budget !== null && typeof v.budget !== 'number') return null
  if (typeof v.kickerEnabled !== 'boolean') return null
  if (typeof v.defenseEnabled !== 'boolean') return null
  if (!Array.isArray(v.assignments)) return null
  if (!Array.isArray(v.favoriteIds)) return null

  return {
    leagueFormatId: v.leagueFormatId as string | null,
    budget: v.budget as number | null,
    kickerEnabled: v.kickerEnabled,
    defenseEnabled: v.defenseEnabled,
    assignments: v.assignments.filter(isValidRosterAssignment),
    favoriteIds: v.favoriteIds.filter((id): id is string => typeof id === 'string'),
  }
}

/**
 * Reads and validates the persisted session. Returns null for a missing
 * key, corrupted (unparseable) JSON, or a top-level shape that doesn't
 * match — every one of those falls back to a fresh Setup screen exactly
 * the same way, per CLAUDE.md.
 */
export function readPersistedSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return parsePersistedSession(JSON.parse(raw))
  } catch {
    return null
  }
}

function readRawObject(): Record<string, unknown> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * Merges `patch` into whatever is currently stored and writes the result
 * back as one blob. Each owning hook calls this with only its own slice
 * whenever that slice changes (see useDraftSession/useRoster/useFavorites),
 * so the three hooks never need to know about each other's fields.
 *
 * Swallows write failures (private browsing, storage disabled, quota) —
 * this is an optional enhancement per CLAUDE.md, never something the app's
 * core functionality can depend on succeeding.
 */
export function writePersistedSessionSlice(patch: Partial<PersistedSession>): void {
  try {
    const merged = { ...readRawObject(), ...patch }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // Ignored — see doc comment above.
  }
}
