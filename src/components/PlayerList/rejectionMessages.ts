// Plain-language mapping of the failure reasons documented on
// AssignmentFailureReason in utils/rosterAssignment.ts. Shared by
// PlayerList and FavoritesList, since each list's onDraft is reachable
// from its own rows (PlayerRow / FavoriteRow).

import type { AssignmentFailureReason } from '../../utils/rosterAssignment'

export const ASSIGNMENT_REJECTION_MESSAGES: Record<AssignmentFailureReason, string> = {
  already_assigned: 'This player is already on your roster.',
  no_eligible_slot: 'No open slot for this position.',
  no_open_capacity: 'Your roster is full for this position.',
}
