// Drives the Save button's enabled state on the Draft page
// (docs/saved_rosters_plan.md: "Save is enabled only when the roster is
// 100% full"). Reuses getActiveSlots/getSlotInstanceIds from
// utils/rosterAssignment.ts — the same active-slot resolution
// validateAssignment and Roster.tsx already use — rather than re-deriving
// which slots are "active" a second time.

import { getActiveSlots, getSlotInstanceIds, type ToggleState } from './rosterAssignment'
import type { RosterPositionSlot } from '../types/League'
import type { RosterAssignment } from '../types/Roster'

export function isRosterComplete(
  assignments: RosterAssignment[],
  slots: RosterPositionSlot[],
  toggles: ToggleState,
): boolean {
  const activeSlots = getActiveSlots(slots, toggles)
  const filledInstanceIds = new Set(assignments.map((a) => a.slotInstanceId))
  return activeSlots.every((slot) => getSlotInstanceIds(slot).every((id) => filledInstanceIds.has(id)))
}
