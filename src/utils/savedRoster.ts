// Builds the denormalized SavedRosterAssignment[] a SavedRoster snapshot
// stores (docs/saved_rosters_plan.md), from the live RosterAssignment[] the
// Draft page already has. Save is only reachable once isRosterComplete is
// true (see rosterCompleteness.ts) and pruneUnknownPlayers has already
// dropped any assignment that resolves to neither a live Player nor a prior
// unresolvedPlayer snapshot (see useRoster.ts) — so every assignment here
// is guaranteed to resolve one way or the other.

import { getActiveSlots, getSlotInstanceIds, type ToggleState } from './rosterAssignment'
import type { RosterPositionSlot } from '../types/League'
import type { RosterAssignment, SavedRosterAssignment } from '../types/Roster'
import type { PlayerWithValuations } from '../types/Player'

export function buildSavedRosterAssignments(
  assignments: RosterAssignment[],
  slots: RosterPositionSlot[],
  toggles: ToggleState,
  players: PlayerWithValuations[],
): SavedRosterAssignment[] {
  const activeSlots = getActiveSlots(slots, toggles)

  return assignments.flatMap((assignment) => {
    const slot = activeSlots.find((s) => assignment.slotInstanceId.startsWith(`${s.id}-`))
    const player = players.find((p) => p.id === assignment.playerId)
    const source = player
      ? { name: player.name, teamCode: player.teamCode, position: player.position }
      : assignment.unresolvedPlayer

    // Neither a live player nor a prior snapshot — shouldn't happen given
    // the invariant above, but skip rather than saving a nameless row.
    if (!slot || !source) return []

    return [
      {
        slotLabel: slot.slotLabel,
        slotInstanceId: assignment.slotInstanceId,
        playerId: assignment.playerId,
        playerName: source.name,
        playerTeam: source.teamCode,
        playerPosition: source.position,
        pricePaid: assignment.pricePaid,
      },
    ]
  })
}

// SavedRosterCard's display order (docs feedback: match the Draft page's
// Roster component — QB/RB/RB/WR/WR/TE/FLEX/FLEX/DST, then BENCH — rather
// than the draft-order the assignments were originally built in). Reuses
// getActiveSlots/getSlotInstanceIds — the same two calls Roster.tsx itself
// uses to derive that order — instead of re-deriving a sort from sortOrder
// independently, so the two can never drift apart.
export function sortSavedRosterAssignments(
  assignments: SavedRosterAssignment[],
  slots: RosterPositionSlot[],
  toggles: ToggleState,
): SavedRosterAssignment[] {
  const canonicalOrder = getActiveSlots(slots, toggles).flatMap(getSlotInstanceIds)
  const orderIndex = new Map(canonicalOrder.map((slotInstanceId, index) => [slotInstanceId, index]))

  return [...assignments].sort(
    (a, b) =>
      (orderIndex.get(a.slotInstanceId) ?? Number.POSITIVE_INFINITY) -
      (orderIndex.get(b.slotInstanceId) ?? Number.POSITIVE_INFINITY),
  )
}
