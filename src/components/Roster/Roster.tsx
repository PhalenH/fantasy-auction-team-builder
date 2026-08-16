// Renders one RosterSlot per active slot instance. Active-slot and
// instance-id derivation come straight from utils/rosterAssignment (the
// same functions validateAssignment uses), not reimplemented here, so
// display and validation can never drift apart.

import { useState } from 'react'
import {
  getActiveSlots,
  getSlotInstanceIds,
  getSwapTargets,
  type ToggleState,
} from '../../utils/rosterAssignment'
import RosterSlot, { type RosterSlotPlayer } from '../RosterSlot/RosterSlot'
import SwapSlotDialog from '../SwapSlotDialog/SwapSlotDialog'
import BudgetDisplay from '../BudgetDisplay/BudgetDisplay'
import type { RosterPositionSlot } from '../../types/League'
import type { RosterAssignment } from '../../types/Roster'
import type { PlayerWithValuations, PositionCode } from '../../types/Player'

// Extends RosterSlotPlayer with position, resolved the same way (live pool
// match, falling back to a resumed assignment's unresolvedPlayer snapshot)
// — RosterSlot itself only ever reads {id, name, byeWeek} off this, but the
// move/swap picker below needs position too, and resolving it here means
// there's exactly one resolution pass per render, reused for both display
// and swap-eligibility rather than two.
interface ResolvedPlayer extends RosterSlotPlayer {
  position: PositionCode | null
}

// Prefers a live pool match; falls back to a resumed assignment's
// unresolvedPlayer snapshot so a saved slot whose real Player row has since
// drifted still renders a name (and a position, for swap eligibility)
// instead of "Empty" (docs/saved_rosters_plan.md).
function resolveDisplayPlayer(
  assignment: RosterAssignment | undefined,
  players: PlayerWithValuations[],
): ResolvedPlayer | null {
  if (!assignment) return null
  const livePlayer = players.find((p) => p.id === assignment.playerId)
  if (livePlayer) {
    return { id: livePlayer.id, name: livePlayer.name, byeWeek: livePlayer.byeWeek, position: livePlayer.position }
  }
  if (assignment.unresolvedPlayer) {
    return {
      id: assignment.playerId,
      name: assignment.unresolvedPlayer.name,
      byeWeek: null,
      position: assignment.unresolvedPlayer.position,
    }
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
  onMoveOrSwap: (sourceSlotInstanceId: string, targetSlotInstanceId: string) => void
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
  onMoveOrSwap,
  budget,
  spent,
  remaining,
}: RosterProps) {
  const activeSlots = getActiveSlots(slots, toggles)

  // Which occupied slot's move/swap picker is open, if any — owned locally
  // (same pattern as SavedRosters.tsx's pendingDeleteId / PlayerList.tsx's
  // isClearConfirmOpen), not lifted to Draft.tsx.
  const [pendingSwapSlotInstanceId, setPendingSwapSlotInstanceId] = useState<string | null>(null)

  const resolvedBySlotInstanceId = new Map<string, ResolvedPlayer>()
  for (const assignment of assignments) {
    const resolved = resolveDisplayPlayer(assignment, players)
    if (resolved) resolvedBySlotInstanceId.set(assignment.slotInstanceId, resolved)
  }

  const positionsBySlotInstanceId = new Map<string, PositionCode>()
  resolvedBySlotInstanceId.forEach((resolved, slotInstanceId) => {
    if (resolved.position) positionsBySlotInstanceId.set(slotInstanceId, resolved.position)
  })

  const pendingSwapSlot =
    pendingSwapSlotInstanceId !== null
      ? activeSlots.find((slot) => getSlotInstanceIds(slot).includes(pendingSwapSlotInstanceId))
      : undefined
  const pendingSwapPlayer =
    pendingSwapSlotInstanceId !== null ? (resolvedBySlotInstanceId.get(pendingSwapSlotInstanceId) ?? null) : null

  const swapTargets =
    pendingSwapSlotInstanceId !== null && pendingSwapSlot && pendingSwapPlayer?.position
      ? getSwapTargets(
          pendingSwapPlayer.position,
          pendingSwapSlot,
          pendingSwapSlotInstanceId,
          slots,
          toggles,
          assignments,
          positionsBySlotInstanceId,
        )
      : []

  function handleSelectTarget(targetSlotInstanceId: string) {
    if (pendingSwapSlotInstanceId === null) return
    onMoveOrSwap(pendingSwapSlotInstanceId, targetSlotInstanceId)
    setPendingSwapSlotInstanceId(null)
  }

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
            const player = resolvedBySlotInstanceId.get(slotInstanceId) ?? null

            return (
              <RosterSlot
                key={slotInstanceId}
                slotLabel={slot.slotLabel}
                player={player}
                pricePaid={assignment?.pricePaid ?? null}
                onUndraft={onUndraft}
                onUpdatePrice={(newPrice) => onUpdatePrice(slotInstanceId, newPrice)}
                onRequestSwap={() => setPendingSwapSlotInstanceId(slotInstanceId)}
              />
            )
          }),
        )}
      </div>

      <SwapSlotDialog
        open={pendingSwapSlotInstanceId !== null}
        playerName={pendingSwapPlayer?.name ?? ''}
        targets={swapTargets.map((target) => ({
          slotInstanceId: target.slotInstanceId,
          slotLabel: target.slot.slotLabel,
          occupant: target.occupant
            ? {
                name: resolvedBySlotInstanceId.get(target.slotInstanceId)?.name ?? '—',
                pricePaid: target.occupant.pricePaid,
              }
            : null,
        }))}
        onSelect={handleSelectTarget}
        onCancel={() => setPendingSwapSlotInstanceId(null)}
      />
    </section>
  )
}

export default Roster
