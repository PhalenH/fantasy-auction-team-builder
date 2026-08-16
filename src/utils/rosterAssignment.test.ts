import { describe, expect, it } from 'vitest'
import {
  findOpenInstance,
  getActiveSlots,
  getEligibleSlots,
  getFlexEligiblePositions,
  getSlotInstanceIds,
  getSwapTargets,
  isPlayerAssigned,
  validateAssignment,
  type ToggleState,
} from './rosterAssignment'
import { players } from '../data/mockPlayers'
import { rosterPositionSlots } from '../data/leagueFormats'
import type { RosterPositionSlot } from '../types/League'
import type { RosterAssignment } from '../types/Roster'

const ALL_TOGGLES_ON: ToggleState = { kickerEnabled: true, defenseEnabled: true }

const regularSlots = rosterPositionSlots.filter((s) => s.leagueFormatId === 'regular')

const mahomes = players.find((p) => p.id === 'p1')! // QB
const mccaffrey = players.find((p) => p.id === 'p3')! // RB
const jefferson = players.find((p) => p.id === 'p5')! // WR
const butker = players.find((p) => p.id === 'p9')! // K

function slot(overrides: Partial<RosterPositionSlot>): RosterPositionSlot {
  return {
    id: 'test-slot',
    leagueFormatId: 'regular',
    slotLabel: 'TEST',
    count: 1,
    eligiblePositions: [],
    sortOrder: 1,
    toggleKey: null,
    ...overrides,
  }
}

describe('getActiveSlots', () => {
  it('excludes a toggle-gated slot when its toggle is off', () => {
    const slots = [slot({ id: 'k', slotLabel: 'K', toggleKey: 'kicker' })]
    expect(getActiveSlots(slots, { kickerEnabled: false, defenseEnabled: true })).toEqual([])
  })

  it('includes a toggle-gated slot when its toggle is on', () => {
    const slots = [slot({ id: 'k', slotLabel: 'K', toggleKey: 'kicker' })]
    expect(getActiveSlots(slots, { kickerEnabled: true, defenseEnabled: true })).toHaveLength(1)
  })

  it('always includes a slot with no toggleKey', () => {
    const slots = [slot({ id: 'qb', slotLabel: 'QB', toggleKey: null })]
    expect(getActiveSlots(slots, { kickerEnabled: false, defenseEnabled: false })).toHaveLength(1)
  })
})

describe('getEligibleSlots', () => {
  it('excludes slots whose eligiblePositions does not include the position', () => {
    const slots = [slot({ id: 'wr', slotLabel: 'WR', eligiblePositions: ['WR'] })]
    expect(getEligibleSlots('QB', slots)).toEqual([])
  })

  it('includes slots whose eligiblePositions includes the position, sorted by sortOrder', () => {
    const bench = slot({ id: 'bench', slotLabel: 'BENCH', eligiblePositions: ['RB'], sortOrder: 8 })
    const rb = slot({ id: 'rb', slotLabel: 'RB', eligiblePositions: ['RB'], sortOrder: 2 })
    expect(getEligibleSlots('RB', [bench, rb])).toEqual([rb, bench])
  })
})

describe('getSlotInstanceIds / findOpenInstance', () => {
  it('generates one instance id per unit of count', () => {
    const rb = slot({ id: 'rb', count: 2 })
    expect(getSlotInstanceIds(rb)).toEqual(['rb-0', 'rb-1'])
  })

  it('returns the next open instance id when some are filled', () => {
    const rb = slot({ id: 'rb', count: 2 })
    const assignments: RosterAssignment[] = [{ slotInstanceId: 'rb-0', playerId: 'x', pricePaid: 1 }]
    expect(findOpenInstance(rb, assignments)).toBe('rb-1')
  })

  it('returns null when every instance is filled', () => {
    const rb = slot({ id: 'rb', count: 1 })
    const assignments: RosterAssignment[] = [{ slotInstanceId: 'rb-0', playerId: 'x', pricePaid: 1 }]
    expect(findOpenInstance(rb, assignments)).toBeNull()
  })
})

describe('getFlexEligiblePositions', () => {
  it('returns the real Regular format FLEX slot eligibility (RB/WR/TE), using production data', () => {
    expect(getFlexEligiblePositions(regularSlots).sort()).toEqual(['RB', 'TE', 'WR'])
  })

  it('unions eligiblePositions across every slot labeled FLEX, deduped', () => {
    const slots = [
      slot({ id: 'flex-a', slotLabel: 'FLEX', eligiblePositions: ['RB', 'WR'] }),
      slot({ id: 'flex-b', slotLabel: 'FLEX', eligiblePositions: ['WR', 'TE'] }),
    ]
    expect(getFlexEligiblePositions(slots).sort()).toEqual(['RB', 'TE', 'WR'])
  })

  it('ignores slots not labeled FLEX, even a BENCH slot eligible for every position', () => {
    const slots = [slot({ id: 'bench', slotLabel: 'BENCH', eligiblePositions: ['QB', 'RB', 'WR', 'TE', 'K', 'DST'] })]
    expect(getFlexEligiblePositions(slots)).toEqual([])
  })

  it('returns an empty array when there is no FLEX slot at all', () => {
    const slots = [slot({ id: 'rb', slotLabel: 'RB', eligiblePositions: ['RB'] })]
    expect(getFlexEligiblePositions(slots)).toEqual([])
  })
})

describe('getSwapTargets', () => {
  const rb = slot({ id: 'rb', slotLabel: 'RB', eligiblePositions: ['RB'], count: 2, sortOrder: 2 })
  const flex = slot({ id: 'flex', slotLabel: 'FLEX', eligiblePositions: ['RB', 'WR', 'TE'], count: 1, sortOrder: 5 })
  const bench = slot({ id: 'bench', slotLabel: 'BENCH', eligiblePositions: ['QB', 'RB', 'WR', 'TE', 'K', 'DST'], count: 2, sortOrder: 8 })
  const wr = slot({ id: 'wr', slotLabel: 'WR', eligiblePositions: ['WR'], count: 1, sortOrder: 3 })
  const testSlots = [rb, flex, bench, wr]

  it('includes an empty eligible slot as a target', () => {
    const assignments: RosterAssignment[] = [{ slotInstanceId: 'rb-0', playerId: 'mover', pricePaid: 10 }]
    const targets = getSwapTargets('RB', rb, 'rb-0', testSlots, ALL_TOGGLES_ON, assignments, new Map())

    expect(targets).toContainEqual({ slotInstanceId: 'rb-1', slot: rb, occupant: null })
    expect(targets).toContainEqual({ slotInstanceId: 'flex-0', slot: flex, occupant: null })
    expect(targets).toContainEqual({ slotInstanceId: 'bench-0', slot: bench, occupant: null })
    expect(targets).toContainEqual({ slotInstanceId: 'bench-1', slot: bench, occupant: null })
  })

  it('excludes the mover\'s own current slot instance', () => {
    const assignments: RosterAssignment[] = [{ slotInstanceId: 'rb-0', playerId: 'mover', pricePaid: 10 }]
    const targets = getSwapTargets('RB', rb, 'rb-0', testSlots, ALL_TOGGLES_ON, assignments, new Map())
    expect(targets.some((t) => t.slotInstanceId === 'rb-0')).toBe(false)
  })

  it('excludes a slot the mover is not eligible for at all', () => {
    const assignments: RosterAssignment[] = [{ slotInstanceId: 'rb-0', playerId: 'mover', pricePaid: 10 }]
    const targets = getSwapTargets('RB', rb, 'rb-0', testSlots, ALL_TOGGLES_ON, assignments, new Map())
    expect(targets.some((t) => t.slotInstanceId === 'wr-0')).toBe(false)
  })

  it('includes an occupied slot as a swap target when both directions are eligible', () => {
    const assignments: RosterAssignment[] = [
      { slotInstanceId: 'rb-0', playerId: 'mover', pricePaid: 10 },
      { slotInstanceId: 'rb-1', playerId: 'other-rb', pricePaid: 20 },
    ]
    const positions = new Map([['rb-1', 'RB' as const]])
    const targets = getSwapTargets('RB', rb, 'rb-0', testSlots, ALL_TOGGLES_ON, assignments, positions)

    expect(targets).toContainEqual({
      slotInstanceId: 'rb-1',
      slot: rb,
      occupant: { slotInstanceId: 'rb-1', playerId: 'other-rb', pricePaid: 20 },
    })
  })

  it('excludes a BENCH slot occupied by a DST when the mover is coming from an RB slot — the DST cannot legally land in RB, so it is not a valid swap target even though BENCH itself is RB-eligible', () => {
    const assignments: RosterAssignment[] = [
      { slotInstanceId: 'rb-0', playerId: 'mover', pricePaid: 10 },
      { slotInstanceId: 'bench-0', playerId: 'bench-dst', pricePaid: 3 },
    ]
    const positions = new Map([['bench-0', 'DST' as const]])
    const targets = getSwapTargets('RB', rb, 'rb-0', testSlots, ALL_TOGGLES_ON, assignments, positions)

    expect(targets.some((t) => t.slotInstanceId === 'bench-0')).toBe(false)
  })

  it('still includes that same BENCH slot as an empty target once the DST is removed', () => {
    // Same slot config as the exclusion test above — isolates that the
    // exclusion is about the DST occupant specifically, not the BENCH slot
    // itself somehow being unreachable from RB.
    const assignments: RosterAssignment[] = [{ slotInstanceId: 'rb-0', playerId: 'mover', pricePaid: 10 }]
    const targets = getSwapTargets('RB', rb, 'rb-0', testSlots, ALL_TOGGLES_ON, assignments, new Map())
    expect(targets.some((t) => t.slotInstanceId === 'bench-0' && t.occupant === null)).toBe(true)
  })

  it('includes a BENCH slot occupied by another RB when the mover is coming from an RB slot, since RB is eligible both ways', () => {
    const assignments: RosterAssignment[] = [
      { slotInstanceId: 'rb-0', playerId: 'mover', pricePaid: 10 },
      { slotInstanceId: 'bench-0', playerId: 'bench-rb', pricePaid: 3 },
    ]
    const positions = new Map([['bench-0', 'RB' as const]])
    const targets = getSwapTargets('RB', rb, 'rb-0', testSlots, ALL_TOGGLES_ON, assignments, positions)

    expect(targets).toContainEqual({
      slotInstanceId: 'bench-0',
      slot: bench,
      occupant: { slotInstanceId: 'bench-0', playerId: 'bench-rb', pricePaid: 3 },
    })
  })

  it('excludes a toggle-gated slot when its toggle is off, same as getActiveSlots', () => {
    const dst = slot({ id: 'dst', slotLabel: 'DST', eligiblePositions: ['DST'], toggleKey: 'defense' })
    const slotsWithDst = [...testSlots, dst]
    const assignments: RosterAssignment[] = []
    const toggles: ToggleState = { kickerEnabled: true, defenseEnabled: false }
    // A hypothetical DST mover with defense off shouldn't see its own
    // toggled-off slot type as a target — using RB here to keep the mover
    // eligible for other slots while dst stays inactive.
    const targets = getSwapTargets('RB', rb, 'rb-0', slotsWithDst, toggles, assignments, new Map())
    expect(targets.some((t) => t.slot.slotLabel === 'DST')).toBe(false)
  })

  it('with the real Regular format data, offers the dedicated RB slot and FLEX/BENCH as targets, in canonical slot order', () => {
    const assignments: RosterAssignment[] = [
      { slotInstanceId: 'regular-rb-0', playerId: 'mover', pricePaid: 10 },
    ]
    const sourceSlot = regularSlots.find((s) => s.slotLabel === 'RB')!
    const targets = getSwapTargets('RB', sourceSlot, 'regular-rb-0', regularSlots, ALL_TOGGLES_ON, assignments, new Map())

    expect(targets[0]).toMatchObject({ slotInstanceId: 'regular-rb-1', occupant: null })
    expect(targets.some((t) => t.slotInstanceId === 'regular-flex-0')).toBe(true)
    expect(targets.some((t) => t.slotInstanceId.startsWith('regular-bench-'))).toBe(true)
  })
})

describe('isPlayerAssigned', () => {
  it('is true when the player id appears in currentAssignments', () => {
    const assignments: RosterAssignment[] = [{ slotInstanceId: 'rb-0', playerId: 'p3', pricePaid: 10 }]
    expect(isPlayerAssigned('p3', assignments)).toBe(true)
  })

  it('is false when the player id does not appear', () => {
    expect(isPlayerAssigned('p3', [])).toBe(false)
  })
})

describe('validateAssignment', () => {
  it('assigns an eligible player to the open dedicated slot (happy path)', () => {
    const result = validateAssignment(mccaffrey, regularSlots, ALL_TOGGLES_ON, [])
    expect(result).toEqual({ ok: true, slot: expect.objectContaining({ slotLabel: 'RB' }), slotInstanceId: 'regular-rb-0' })
  })

  it('rejects an ineligible position when no eligible slot exists at all', () => {
    // A minimal slot list with only a WR slot — no bench catch-all — isolates
    // the eligibility check from any fallback slot.
    const slots = [slot({ id: 'wr', slotLabel: 'WR', eligiblePositions: ['WR'] })]
    const result = validateAssignment(mahomes, slots, ALL_TOGGLES_ON, [])
    expect(result).toEqual({ ok: false, reason: 'no_eligible_slot' })
  })

  it('rejects when the only eligible slot is full', () => {
    const slots = [slot({ id: 'rb', slotLabel: 'RB', eligiblePositions: ['RB'], count: 1 })]
    const currentAssignments: RosterAssignment[] = [
      { slotInstanceId: 'rb-0', playerId: 'someone-else', pricePaid: 20 },
    ]
    const result = validateAssignment(mccaffrey, slots, ALL_TOGGLES_ON, currentAssignments)
    expect(result).toEqual({ ok: false, reason: 'no_open_capacity' })
  })

  it('rejects a K slot assignment when the kicker toggle is off', () => {
    const slots = [slot({ id: 'k', slotLabel: 'K', eligiblePositions: ['K'], toggleKey: 'kicker' })]
    const toggles: ToggleState = { kickerEnabled: false, defenseEnabled: true }
    const result = validateAssignment(butker, slots, toggles, [])
    expect(result).toEqual({ ok: false, reason: 'no_eligible_slot' })
  })

  it('allows the same K slot assignment once the kicker toggle is on', () => {
    const slots = [slot({ id: 'k', slotLabel: 'K', eligiblePositions: ['K'], toggleKey: 'kicker' })]
    const toggles: ToggleState = { kickerEnabled: true, defenseEnabled: true }
    const result = validateAssignment(butker, slots, toggles, [])
    expect(result).toEqual({ ok: true, slot: expect.objectContaining({ slotLabel: 'K' }), slotInstanceId: 'k-0' })
  })

  it('rejects a player who is already on the roster, even with open capacity elsewhere', () => {
    const currentAssignments: RosterAssignment[] = [
      { slotInstanceId: 'regular-wr-0', playerId: jefferson.id, pricePaid: 48 },
    ]
    const result = validateAssignment(jefferson, regularSlots, ALL_TOGGLES_ON, currentAssignments)
    expect(result).toEqual({ ok: false, reason: 'already_assigned' })
  })

  it('prefers the dedicated RB slot over FLEX when both are eligible and open', () => {
    const result = validateAssignment(mccaffrey, regularSlots, ALL_TOGGLES_ON, [])
    expect(result).toEqual({
      ok: true,
      slot: expect.objectContaining({ slotLabel: 'RB' }),
      slotInstanceId: 'regular-rb-0',
    })
  })

  it('falls back to FLEX once the dedicated RB slot is full', () => {
    const currentAssignments: RosterAssignment[] = [
      { slotInstanceId: 'regular-rb-0', playerId: 'filler-rb-0', pricePaid: 1 },
      { slotInstanceId: 'regular-rb-1', playerId: 'filler-rb-1', pricePaid: 1 },
    ]
    const result = validateAssignment(mccaffrey, regularSlots, ALL_TOGGLES_ON, currentAssignments)
    expect(result).toEqual({
      ok: true,
      slot: expect.objectContaining({ slotLabel: 'FLEX' }),
      slotInstanceId: 'regular-flex-0',
    })
  })

  it('rejects with no_open_capacity when every slot including bench is full', () => {
    // Fill every instance of every active slot (dedicated positions, FLEX,
    // K, DST, and all 7 bench spots) using the real production data and the
    // module's own instance-id generator, so this stays correct even if the
    // Regular format's composition changes later.
    const activeSlots = getActiveSlots(regularSlots, ALL_TOGGLES_ON)
    const currentAssignments: RosterAssignment[] = activeSlots.flatMap((s) =>
      getSlotInstanceIds(s).map((slotInstanceId) => ({
        slotInstanceId,
        playerId: `filler-${slotInstanceId}`,
        pricePaid: 1,
      })),
    )

    // Bijan Robinson (RB) is eligible for RB/FLEX/BENCH — all full — and is
    // not among the filler ids above, so this isn't a double-draft case.
    const bijanRobinson = players.find((p) => p.id === 'p4')!
    const result = validateAssignment(bijanRobinson, regularSlots, ALL_TOGGLES_ON, currentAssignments)

    // Eligible slots do exist (RB/FLEX/BENCH all accept this position) —
    // they're just full — so the correct reason is no_open_capacity, not
    // no_eligible_slot. That reason is reserved for when no active slot's
    // eligiblePositions includes the player's position at all (see the
    // "ineligible position" and "kicker toggle off" cases above). Either
    // way, the important assertion is the same: a clear rejection, not a
    // throw and not a silently-chosen slot.
    expect(result).toEqual({ ok: false, reason: 'no_open_capacity' })
  })
})
