// Roster assignment rules — see docs/datamodel.md's "Kicker/Defense
// toggles" and "Roster composition" sections, and CLAUDE.md's Draft/Roster
// Interface requirements (no double-drafting, no assignment without an
// available slot).
//
// validateAssignment is the single entry point the UI/hooks should call.
// The sub-steps (a-d below) are exported individually too, since each is
// independently meaningful and independently testable.

import type { Player, PositionCode } from '../types/Player'
import type { RosterPositionSlot, ToggleKey } from '../types/League'
import type { RosterAssignment } from '../types/Roster'

export interface ToggleState {
  kickerEnabled: boolean
  defenseEnabled: boolean
}

export type AssignmentFailureReason =
  /**
   * The player already appears in currentAssignments (by playerId).
   * Expected to be rare/defensive: the player-pool UI should already mark
   * drafted players as non-clickable, so this mainly guards against stale
   * UI state or a double-click racing ahead of a re-render.
   */
  | 'already_assigned'
  /**
   * After applying the kicker/defense toggles, no active slot's
   * eligiblePositions includes this player's position at all — e.g. a K
   * player while the kicker toggle is off. Also expected to be rare/
   * defensive: the player-pool UI is expected to filter out (or hide)
   * players whose position has no active eligible slot before they're
   * clickable, so surfacing this in practice likely means the pool filter
   * and the toggle state have drifted out of sync. UI treatment: log/
   * investigate rather than just showing a generic message, if it ever
   * fires.
   */
  | 'no_eligible_slot'
  /**
   * At least one active slot is eligible for this position, but every
   * instance of every such slot — including BENCH, which accepts any
   * position — is already filled. This is the common, expected rejection
   * once a roster fills up (most players reach this rather than
   * no_eligible_slot, since BENCH is a catch-all). UI treatment: show a
   * normal "no open roster spot" message; this is a routine outcome, not a
   * bug signal.
   */
  | 'no_open_capacity'

export type AssignmentResult =
  | { ok: true; slot: RosterPositionSlot; slotInstanceId: string }
  | { ok: false; reason: AssignmentFailureReason }

function isSlotActive(toggleKey: ToggleKey | null, toggles: ToggleState): boolean {
  if (toggleKey === null) return true
  if (toggleKey === 'kicker') return toggles.kickerEnabled
  return toggles.defenseEnabled
}

// (a) which slots are "active" this session
export function getActiveSlots(
  slots: RosterPositionSlot[],
  toggles: ToggleState,
): RosterPositionSlot[] {
  return slots.filter((slot) => isSlotActive(slot.toggleKey, toggles))
}

// (b) which active slot(s) a given position is eligible for. Sorted by
// sortOrder so validateAssignment prefers a dedicated slot (e.g. RB) over a
// more general one (e.g. FLEX, BENCH) when both are open.
export function getEligibleSlots(
  position: PositionCode,
  activeSlots: RosterPositionSlot[],
): RosterPositionSlot[] {
  return activeSlots
    .filter((slot) => slot.eligiblePositions.includes(position))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

// A RosterPositionSlot with count > 1 (e.g. RB: 2) represents multiple
// interchangeable instances. Instance ids are derived deterministically
// from the slot id rather than stored, since the slot config itself never
// changes at runtime.
export function getSlotInstanceIds(slot: RosterPositionSlot): string[] {
  return Array.from({ length: slot.count }, (_, index) => `${slot.id}-${index}`)
}

// (c) whether an eligible slot still has open capacity
export function findOpenInstance(
  slot: RosterPositionSlot,
  currentAssignments: RosterAssignment[],
): string | null {
  const filled = new Set(currentAssignments.map((a) => a.slotInstanceId))
  const open = getSlotInstanceIds(slot).find((id) => !filled.has(id))
  return open ?? null
}

// (d) whether the player has already been assigned
export function isPlayerAssigned(
  playerId: string,
  currentAssignments: RosterAssignment[],
): boolean {
  return currentAssignments.some((a) => a.playerId === playerId)
}

// (e) which positions the active format's FLEX slot(s) accept — e.g.
// {RB, WR, TE} today. Backs the player pool's FLEX filter button
// (PlayerFilters.tsx/PlayerList.tsx): FLEX isn't itself a Position code, so
// it can't be matched via player.position the way every other filter
// button is — this derives the equivalent set from RosterPositionSlot
// config instead, keyed specifically on slotLabel === 'FLEX' (the
// canonical label docs/datamodel.md uses), not hardcoded to {RB, WR, TE},
// so it stays correct if a format's FLEX eligibility ever differs. Not
// toggle-gated by design (unlike getActiveSlots) — every current format's
// FLEX slot already has toggleKey: null (always active), so filtering
// through toggles here would be a no-op in practice; deriving straight
// from the raw slot config keeps this correct without depending on that
// coincidence.
export function getFlexEligiblePositions(slots: RosterPositionSlot[]): PositionCode[] {
  const positions = new Set<PositionCode>()
  slots
    .filter((slot) => slot.slotLabel === 'FLEX')
    .forEach((slot) => slot.eligiblePositions.forEach((position) => positions.add(position)))
  return Array.from(positions)
}

export function validateAssignment(
  player: Player,
  slots: RosterPositionSlot[],
  toggles: ToggleState,
  currentAssignments: RosterAssignment[],
): AssignmentResult {
  if (isPlayerAssigned(player.id, currentAssignments)) {
    return { ok: false, reason: 'already_assigned' }
  }

  const activeSlots = getActiveSlots(slots, toggles)
  const eligibleSlots = getEligibleSlots(player.position, activeSlots)

  if (eligibleSlots.length === 0) {
    return { ok: false, reason: 'no_eligible_slot' }
  }

  for (const slot of eligibleSlots) {
    const slotInstanceId = findOpenInstance(slot, currentAssignments)
    if (slotInstanceId) {
      return { ok: true, slot, slotInstanceId }
    }
  }

  return { ok: false, reason: 'no_open_capacity' }
}
