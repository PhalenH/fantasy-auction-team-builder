// Renders one RosterSlot per active slot instance. Active-slot and
// instance-id derivation come straight from utils/rosterAssignment (the
// same functions validateAssignment uses), not reimplemented here, so
// display and validation can never drift apart.

import { getActiveSlots, getSlotInstanceIds, type ToggleState } from '../../utils/rosterAssignment'
import RosterSlot, { type RosterSlotPlayer } from '../RosterSlot/RosterSlot'
import BudgetDisplay from '../BudgetDisplay/BudgetDisplay'
import type { RosterPositionSlot } from '../../types/League'
import type { RosterAssignment } from '../../types/Roster'
import type { PlayerWithValuations } from '../../types/Player'

// Prefers a live pool match; falls back to a resumed assignment's
// unresolvedPlayer snapshot so a saved slot whose real Player row has since
// drifted still renders a name instead of "Empty" (docs/saved_rosters_plan.md).
function resolveDisplayPlayer(
  assignment: RosterAssignment | undefined,
  players: PlayerWithValuations[],
): RosterSlotPlayer | null {
  if (!assignment) return null
  const livePlayer = players.find((p) => p.id === assignment.playerId)
  if (livePlayer) return { id: livePlayer.id, name: livePlayer.name, byeWeek: livePlayer.byeWeek }
  if (assignment.unresolvedPlayer) {
    return { id: assignment.playerId, name: assignment.unresolvedPlayer.name, byeWeek: null }
  }
  return null
}

interface RosterProps {
  slots: RosterPositionSlot[]
  toggles: ToggleState
  assignments: RosterAssignment[]
  players: PlayerWithValuations[]
  onUndraft: (playerId: string) => void
  onUpdatePrice: (slotInstanceId: string, newPrice: number) => void
  budget: number
  spent: number
  remaining: number
}

function Roster({
  slots,
  toggles,
  assignments,
  players,
  onUndraft,
  onUpdatePrice,
  budget,
  spent,
  remaining,
}: RosterProps) {
  const activeSlots = getActiveSlots(slots, toggles)

  return (
    <section aria-label="Roster" className="rounded-lg border border-slate-200 bg-parchment p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Roster</h2>
        <BudgetDisplay budget={budget} spent={spent} remaining={remaining} />
      </div>
      <div className="space-y-1">
        {activeSlots.map((slot) =>
          getSlotInstanceIds(slot).map((slotInstanceId) => {
            const assignment = assignments.find((a) => a.slotInstanceId === slotInstanceId)
            const player = resolveDisplayPlayer(assignment, players)

            return (
              <RosterSlot
                key={slotInstanceId}
                slotLabel={slot.slotLabel}
                player={player}
                pricePaid={assignment?.pricePaid ?? null}
                onUndraft={onUndraft}
                onUpdatePrice={(newPrice) => onUpdatePrice(slotInstanceId, newPrice)}
              />
            )
          }),
        )}
      </div>
    </section>
  )
}

export default Roster
