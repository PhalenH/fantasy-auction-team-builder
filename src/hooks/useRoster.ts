// Owns the RosterAssignment list for the current session (see CLAUDE.md's
// Session Isolation section — this state never reaches the server). It's
// mirrored into the shared sessionStorage blob (see sessionPersistence.ts)
// so it survives a page refresh, per CLAUDE.md's Session Isolation
// "Optional enhancement".
//
// The actual draft decision (validate + compute price_paid) is a small
// pure function, computeDraftResult, kept separate from the React state
// wiring below so it's directly unit-testable per CLAUDE.md's "write tests
// for important business logic" rule, without rendering a component.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isPlayerAssigned,
  validateAssignment,
  type AssignmentFailureReason,
  type ToggleState,
} from '../utils/rosterAssignment'
import { getCombinedAuctionValue } from '../utils/auctionCalculations'
import { getRemainingBudget, getSpent } from '../utils/budgetCalculations'
import { readPersistedSession, writePersistedSessionSlice } from './sessionPersistence'
import type { RosterPositionSlot } from '../types/League'
import type { RosterAssignment, SavedRosterAssignment } from '../types/Roster'
import type { PlayerWithValuations } from '../types/Player'

export type DraftPlayerResult =
  | { ok: true; assignment: RosterAssignment }
  | { ok: false; reason: AssignmentFailureReason }

// price_paid is always the player's calculated combined value at the
// moment of assignment — a frozen snapshot, never a manual entry (see
// docs/datamodel.md's RosterAssignment note). No budget check gates this:
// overspending is allowed, not blocked (see "Budget enforcement" in
// docs/datamodel.md).
export function computeDraftResult(
  player: PlayerWithValuations,
  slots: RosterPositionSlot[],
  toggles: ToggleState,
  currentAssignments: RosterAssignment[],
): DraftPlayerResult {
  const validation = validateAssignment(player, slots, toggles, currentAssignments)

  if (!validation.ok) {
    return { ok: false, reason: validation.reason }
  }

  const pricePaid = getCombinedAuctionValue(player.valuations) ?? 0

  return {
    ok: true,
    assignment: {
      slotInstanceId: validation.slotInstanceId,
      playerId: player.id,
      pricePaid,
    },
  }
}

// Un-drafting is a plain removal — nothing to validate, since an existing
// assignment is always safe to remove. Kept as its own pure function
// anyway, mirroring computeDraftResult, so it's directly unit-testable
// without rendering the hook.
export function removeAssignment(
  assignments: RosterAssignment[],
  playerId: string,
): RosterAssignment[] {
  return assignments.filter((a) => a.playerId !== playerId)
}

// "Clear roster" (the Players panel's refresh/reset control) un-drafts
// every currently-assigned player at once — deliberately expressed as
// repeated removeAssignment calls rather than a bare `[]`, so it can never
// drift from what a single un-draft does (e.g. if removeAssignment ever
// grows side effects). Converges to [] either way, since every entry gets
// removed, but this keeps un-drafting-one-player as the single source of
// truth for what "un-drafted" means.
export function clearAllAssignments(assignments: RosterAssignment[]): RosterAssignment[] {
  return assignments.reduce(
    (remaining, assignment) => removeAssignment(remaining, assignment.playerId),
    assignments,
  )
}

// Drops any assignment whose playerId isn't in knownPlayerIds, rather than
// failing outright. Exists for sessionStorage rehydration: a persisted
// RosterAssignment can outlive the player it points at (a data refresh
// removed or re-identified that player), and the player pool itself only
// loads asynchronously after this hook already mounted with whatever was in
// storage — so this runs as a follow-up correction once the real pool
// arrives (see Draft.tsx), not as part of reading storage itself.
//
// An assignment carrying unresolvedPlayer is deliberately exempt: that
// field only ever gets set by hydrateAssignmentsFromSavedRoster below, for
// a playerId that was already confirmed not to resolve at resume time. It's
// an intentional frozen snapshot, not mid-session drift, so pruning it here
// would silently undo the exact resume behavior it exists for.
export function pruneAssignmentsForKnownPlayers(
  assignments: RosterAssignment[],
  knownPlayerIds: ReadonlySet<string>,
): RosterAssignment[] {
  return assignments.filter(
    (assignment) => assignment.unresolvedPlayer !== undefined || knownPlayerIds.has(assignment.playerId),
  )
}

// Resume flow (docs/saved_rosters_plan.md): turns a SavedRoster's frozen
// assignments back into live RosterAssignment[], resolving each playerId
// against the current pool. A playerId that no longer resolves still
// occupies its slot — via the denormalized snapshot carried on the save —
// rather than being dropped, per the plan's edge-case handling.
export function hydrateAssignmentsFromSavedRoster(
  savedAssignments: SavedRosterAssignment[],
  knownPlayers: PlayerWithValuations[],
): RosterAssignment[] {
  const knownPlayerIds = new Set(knownPlayers.map((player) => player.id))
  return savedAssignments.map((saved) => {
    if (knownPlayerIds.has(saved.playerId)) {
      return { slotInstanceId: saved.slotInstanceId, playerId: saved.playerId, pricePaid: saved.pricePaid }
    }
    return {
      slotInstanceId: saved.slotInstanceId,
      playerId: saved.playerId,
      pricePaid: saved.pricePaid,
      unresolvedPlayer: {
        name: saved.playerName,
        teamCode: saved.playerTeam,
        position: saved.playerPosition,
      },
    }
  })
}

// Manual price editing (docs/manual_bid_entry_plan.md) — a deliberately
// separate, explicit edit of an *existing* RosterAssignment from the roster
// view, distinct from computeDraftResult's automatic price_paid at
// assignment time. Lives here rather than utils/rosterAssignment.ts, which
// only validates slot eligibility/capacity and has never touched price —
// this is a pure RosterAssignment[] operation like removeAssignment above,
// so it belongs next to it.

export const PRICE_INCREMENT = 0.5
export const MIN_PRICE = 1

// Rounds to the nearest $0.50 increment — the only granularity any
// calculated combined value ever lands on (docs/manual_bid_entry_plan.md,
// Validation) — and enforces the $1 minimum. No maximum: consistent with
// "overspending is allowed, not blocked" (docs/datamodel.md, Budget
// enforcement). Non-finite input (e.g. a cleared/invalid typed value)
// clamps to the minimum rather than propagating NaN into spend totals.
export function normalizePrice(rawPrice: number): number {
  if (!Number.isFinite(rawPrice)) return MIN_PRICE
  const rounded = Math.round(rawPrice / PRICE_INCREMENT) * PRICE_INCREMENT
  return Math.max(MIN_PRICE, rounded)
}

// Edits the price of the assignment occupying slotInstanceId. A no-op if
// that slot isn't currently occupied (mirrors removeAssignment's no-op
// behavior for an untracked id, rather than throwing).
export function updateAssignmentPrice(
  assignments: RosterAssignment[],
  slotInstanceId: string,
  newPrice: number,
): RosterAssignment[] {
  return assignments.map((assignment) =>
    assignment.slotInstanceId === slotInstanceId
      ? { ...assignment, pricePaid: normalizePrice(newPrice) }
      : assignment,
  )
}

// Manual move/swap (RosterSlot's swap icon) — moves the assignment at
// sourceSlotInstanceId to targetSlotInstanceId. If the target is already
// occupied, the two assignments exchange slotInstanceIds (a swap); if
// empty, only the source assignment's slotInstanceId changes. playerId and
// pricePaid are never touched on either side — this only ever moves which
// slot an assignment is attached to, so budget/spent totals (which already
// sum pricePaid regardless of slot) are unaffected without any changes
// there, and this works identically for an assignment carrying an
// unresolvedPlayer snapshot, since that field is untouched too.
//
// A no-op if sourceSlotInstanceId isn't currently occupied, same
// no-op-on-untracked-id convention as updateAssignmentPrice/removeAssignment
// above. Eligibility (including the target-slot bidirectional check) is the
// caller's responsibility — see getSwapTargets in utils/rosterAssignment.ts
// — this function trusts whatever target it's given and just performs the
// move. Lives here rather than rosterAssignment.ts for the same reason
// updateAssignmentPrice does: it's a plain RosterAssignment[] mutation with
// no slot-eligibility logic of its own, not a validation step.
export function moveOrSwapAssignment(
  assignments: RosterAssignment[],
  sourceSlotInstanceId: string,
  targetSlotInstanceId: string,
): RosterAssignment[] {
  const sourceIndex = assignments.findIndex((a) => a.slotInstanceId === sourceSlotInstanceId)
  if (sourceIndex === -1) return assignments

  const targetIndex = assignments.findIndex((a) => a.slotInstanceId === targetSlotInstanceId)

  return assignments.map((assignment, index) => {
    if (index === sourceIndex) return { ...assignment, slotInstanceId: targetSlotInstanceId }
    if (index === targetIndex) return { ...assignment, slotInstanceId: sourceSlotInstanceId }
    return assignment
  })
}

export interface UseRosterOptions {
  slots: RosterPositionSlot[]
  toggles: ToggleState
  budget: number
}

export interface UseRosterResult {
  assignments: RosterAssignment[]
  spent: number
  remaining: number
  isPlayerDrafted: (playerId: string) => boolean
  draftPlayer: (player: PlayerWithValuations) => DraftPlayerResult
  undraftPlayer: (playerId: string) => void
  updatePrice: (slotInstanceId: string, newPrice: number) => void
  moveOrSwap: (sourceSlotInstanceId: string, targetSlotInstanceId: string) => void
  clearRoster: () => void
  pruneUnknownPlayers: (knownPlayers: PlayerWithValuations[]) => void
  loadFromSavedRoster: (savedAssignments: SavedRosterAssignment[], knownPlayers: PlayerWithValuations[]) => void
}

export function useRoster({ slots, toggles, budget }: UseRosterOptions): UseRosterResult {
  // Ref rather than a module-level read, same reasoning as useDraftSession:
  // each hook instance should re-read sessionStorage at its own mount time.
  const persistedRef = useRef<RosterAssignment[] | undefined>(undefined)
  if (persistedRef.current === undefined) {
    persistedRef.current = readPersistedSession()?.assignments ?? []
  }

  const [assignments, setAssignments] = useState<RosterAssignment[]>(persistedRef.current)

  useEffect(() => {
    writePersistedSessionSlice({ assignments })
  }, [assignments])

  const draftPlayer = useCallback(
    (player: PlayerWithValuations): DraftPlayerResult => {
      const result = computeDraftResult(player, slots, toggles, assignments)
      if (result.ok) {
        setAssignments((prev) => [...prev, result.assignment])
      }
      return result
    },
    [slots, toggles, assignments],
  )

  // Removing a RosterAssignment never touches favorites — the two are
  // independent flags (CLAUDE.md's Favorites section), and favorites live
  // in a completely separate hook/state, so there's nothing here that
  // could couple them even accidentally.
  const undraftPlayer = useCallback((playerId: string) => {
    setAssignments((prev) => removeAssignment(prev, playerId))
  }, [])

  // spent/remaining below are derived from `assignments` on every render, so
  // routing an edit through this same setAssignments call is what makes the
  // budget display recalculate immediately — there is no separate price
  // state to keep in sync.
  const updatePrice = useCallback((slotInstanceId: string, newPrice: number) => {
    setAssignments((prev) => updateAssignmentPrice(prev, slotInstanceId, newPrice))
  }, [])

  // Same reasoning as updatePrice above: routing the move/swap through this
  // same setAssignments call is what makes budget/spent recalculate (or, in
  // this case, correctly stay put) immediately — nothing else to keep in
  // sync.
  const moveOrSwap = useCallback((sourceSlotInstanceId: string, targetSlotInstanceId: string) => {
    setAssignments((prev) => moveOrSwapAssignment(prev, sourceSlotInstanceId, targetSlotInstanceId))
  }, [])

  // Same independence from favorites as undraftPlayer above — clearing
  // every RosterAssignment never touches the favorites id-set, which lives
  // in a completely separate hook/state.
  const clearRoster = useCallback(() => {
    setAssignments((prev) => clearAllAssignments(prev))
  }, [])

  const isPlayerDrafted = useCallback(
    (playerId: string) => isPlayerAssigned(playerId, assignments),
    [assignments],
  )

  // See pruneAssignmentsForKnownPlayers above for why this is a separate,
  // explicitly-called step rather than folded into rehydration itself.
  const pruneUnknownPlayers = useCallback((knownPlayers: PlayerWithValuations[]) => {
    const knownPlayerIds = new Set(knownPlayers.map((player) => player.id))
    setAssignments((prev) => pruneAssignmentsForKnownPlayers(prev, knownPlayerIds))
  }, [])

  // Resume flow: wholesale-replaces the current roster with a saved one —
  // deliberately not merged with whatever was already drafted, matching
  // "resuming will discard the in-progress draft" (see App.tsx's
  // confirm() gate before this is ever called).
  const loadFromSavedRoster = useCallback(
    (savedAssignments: SavedRosterAssignment[], knownPlayers: PlayerWithValuations[]) => {
      setAssignments(hydrateAssignmentsFromSavedRoster(savedAssignments, knownPlayers))
    },
    [],
  )

  return {
    assignments,
    spent: getSpent(assignments),
    remaining: getRemainingBudget(budget, assignments),
    isPlayerDrafted,
    draftPlayer,
    undraftPlayer,
    updatePrice,
    moveOrSwap,
    clearRoster,
    pruneUnknownPlayers,
    loadFromSavedRoster,
  }
}
