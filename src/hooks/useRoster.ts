// Owns the RosterAssignment list for the current session (see CLAUDE.md's
// Session Isolation section — this state never reaches the server).
//
// The actual draft decision (validate + compute price_paid) is a small
// pure function, computeDraftResult, kept separate from the React state
// wiring below so it's directly unit-testable per CLAUDE.md's "write tests
// for important business logic" rule, without rendering a component.

import { useCallback, useState } from 'react'
import {
  isPlayerAssigned,
  validateAssignment,
  type AssignmentFailureReason,
  type ToggleState,
} from '../utils/rosterAssignment'
import { getCombinedAuctionValue } from '../utils/auctionCalculations'
import { getRemainingBudget, getSpent } from '../utils/budgetCalculations'
import type { RosterPositionSlot } from '../types/League'
import type { RosterAssignment } from '../types/Roster'
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
  clearRoster: () => void
}

export function useRoster({ slots, toggles, budget }: UseRosterOptions): UseRosterResult {
  const [assignments, setAssignments] = useState<RosterAssignment[]>([])

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

  return {
    assignments,
    spent: getSpent(assignments),
    remaining: getRemainingBudget(budget, assignments),
    isPlayerDrafted,
    draftPlayer,
    undraftPlayer,
    updatePrice,
    clearRoster,
  }
}
