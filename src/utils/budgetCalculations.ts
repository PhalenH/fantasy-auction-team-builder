// Budget math over frontend-only RosterAssignment state (see CLAUDE.md's
// Session Isolation & State Persistence — spent/remaining are never
// computed or stored server-side).

import type { RosterAssignment } from '../types/Roster'

export function getSpent(assignments: RosterAssignment[]): number {
  return assignments.reduce((sum, a) => sum + a.pricePaid, 0)
}

// Not clamped to zero — an overspend (shouldn't happen if rosterAssignment's
// validation is respected) surfaces as a negative remaining budget rather
// than being silently hidden.
export function getRemainingBudget(
  budget: number,
  assignments: RosterAssignment[],
): number {
  return budget - getSpent(assignments)
}
