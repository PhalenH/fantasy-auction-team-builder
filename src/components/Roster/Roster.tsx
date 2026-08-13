// Renders one RosterSlot per active slot instance. Active-slot and
// instance-id derivation come straight from utils/rosterAssignment (the
// same functions validateAssignment uses), not reimplemented here, so
// display and validation can never drift apart.

import { getActiveSlots, getSlotInstanceIds, type ToggleState } from '../../utils/rosterAssignment'
import RosterSlot from '../RosterSlot/RosterSlot'
import BudgetDisplay from '../BudgetDisplay/BudgetDisplay'
import type { RosterPositionSlot } from '../../types/League'
import type { RosterAssignment } from '../../types/Roster'
import type { PlayerWithValuations } from '../../types/Player'

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
            const player = assignment
              ? players.find((p) => p.id === assignment.playerId) ?? null
              : null

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
