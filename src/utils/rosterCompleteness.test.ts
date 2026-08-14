import { describe, expect, it } from 'vitest'
import { isRosterComplete } from './rosterCompleteness'
import { getSlotInstanceIds } from './rosterAssignment'
import { rosterPositionSlots } from '../data/leagueFormats'
import type { RosterAssignment } from '../types/Roster'
import type { ToggleState } from './rosterAssignment'

const ALL_TOGGLES_ON: ToggleState = { kickerEnabled: true, defenseEnabled: true }
const ALL_TOGGLES_OFF: ToggleState = { kickerEnabled: false, defenseEnabled: false }
const regularSlots = rosterPositionSlots.filter((s) => s.leagueFormatId === 'regular')

function fillEveryActiveSlot(toggles: ToggleState): RosterAssignment[] {
  const active = toggles.kickerEnabled && toggles.defenseEnabled
    ? regularSlots
    : regularSlots.filter((s) => s.toggleKey === null)
  return active.flatMap((slot) =>
    getSlotInstanceIds(slot).map((slotInstanceId, index) => ({
      slotInstanceId,
      playerId: `${slotInstanceId}-player-${index}`,
      pricePaid: 5,
    })),
  )
}

describe('isRosterComplete', () => {
  it('is false with no assignments', () => {
    expect(isRosterComplete([], regularSlots, ALL_TOGGLES_ON)).toBe(false)
  })

  it('is false when at least one active slot instance (e.g. a BENCH spot) is still open', () => {
    const assignments = fillEveryActiveSlot(ALL_TOGGLES_ON).slice(0, -1)
    expect(isRosterComplete(assignments, regularSlots, ALL_TOGGLES_ON)).toBe(false)
  })

  it('is true once every active slot instance, including all BENCH slots, has an assignment', () => {
    const assignments = fillEveryActiveSlot(ALL_TOGGLES_ON)
    expect(isRosterComplete(assignments, regularSlots, ALL_TOGGLES_ON)).toBe(true)
  })

  it('does not require the toggled-off K/DST slots to be filled', () => {
    const assignments = fillEveryActiveSlot(ALL_TOGGLES_OFF)
    expect(isRosterComplete(assignments, regularSlots, ALL_TOGGLES_OFF)).toBe(true)
    // Same assignment set is incomplete once K/DST are toggled back on, since
    // those two slots have no assignment.
    expect(isRosterComplete(assignments, regularSlots, ALL_TOGGLES_ON)).toBe(false)
  })

  it('ignores an assignment for a slotInstanceId that is not part of the active roster at all', () => {
    const assignments = [
      ...fillEveryActiveSlot(ALL_TOGGLES_ON),
      { slotInstanceId: 'not-a-real-slot', playerId: 'ghost', pricePaid: 1 },
    ]
    expect(isRosterComplete(assignments, regularSlots, ALL_TOGGLES_ON)).toBe(true)
  })
})
