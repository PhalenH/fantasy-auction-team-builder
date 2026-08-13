// Tests target computeDraftResult directly — the pure function useRoster
// wraps in useState — so the draft-decision logic is verified without
// rendering a component or a hook-testing library.

import { describe, expect, it } from 'vitest'
import {
  clearAllAssignments,
  computeDraftResult,
  normalizePrice,
  removeAssignment,
  updateAssignmentPrice,
} from './useRoster'
import { getCombinedAuctionValue } from '../utils/auctionCalculations'
import { getRemainingBudget, getSpent } from '../utils/budgetCalculations'
import { rosterPositionSlots } from '../data/leagueFormats'
import type { RosterPositionSlot } from '../types/League'
import type { RosterAssignment } from '../types/Roster'
import type { PlayerWithValuations } from '../types/Player'
import type { ToggleState } from '../utils/rosterAssignment'

const ALL_TOGGLES_ON: ToggleState = { kickerEnabled: true, defenseEnabled: true }
const regularSlots = rosterPositionSlots.filter((s) => s.leagueFormatId === 'regular')

function playerWithValuations(overrides: Partial<PlayerWithValuations> = {}): PlayerWithValuations {
  return {
    id: 'test-rb',
    name: 'Test Runningback',
    teamCode: 'TST',
    teamDisplayName: 'Test Team',
    position: 'RB',
    byeWeek: 1,
    valuations: [
      { id: 'v1', playerId: 'test-rb', source: 'espn', auctionValue: 50, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
      { id: 'v2', playerId: 'test-rb', source: 'yahoo', auctionValue: 60, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
    ],
    ...overrides,
  }
}

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

describe('computeDraftResult', () => {
  it('drafts an eligible player into the open dedicated slot (happy path)', () => {
    const player = playerWithValuations()
    const result = computeDraftResult(player, regularSlots, ALL_TOGGLES_ON, [])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.assignment).toEqual({
        slotInstanceId: 'regular-rb-0',
        playerId: 'test-rb',
        pricePaid: 55, // mean of 50 and 60
      })
    }
  })

  it('sets pricePaid to the calculated combined value, not a manually supplied price', () => {
    const player = playerWithValuations({
      id: 'test-rb-2',
      valuations: [
        { id: 'v1', playerId: 'test-rb-2', source: 'espn', auctionValue: 21, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
        { id: 'v2', playerId: 'test-rb-2', source: 'yahoo', auctionValue: 24, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
      ],
    })
    const result = computeDraftResult(player, regularSlots, ALL_TOGGLES_ON, [])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.assignment.pricePaid).toBe(getCombinedAuctionValue(player.valuations))
    }
  })

  it('defaults pricePaid to 0 when the player has no valuation data at all', () => {
    const player = playerWithValuations({ id: 'test-rb-3', valuations: [] })
    const result = computeDraftResult(player, regularSlots, ALL_TOGGLES_ON, [])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.assignment.pricePaid).toBe(0)
    }
  })

  it('surfaces the already_assigned reason unchanged from validateAssignment', () => {
    const player = playerWithValuations()
    const currentAssignments: RosterAssignment[] = [
      { slotInstanceId: 'regular-rb-0', playerId: player.id, pricePaid: 55 },
    ]
    const result = computeDraftResult(player, regularSlots, ALL_TOGGLES_ON, currentAssignments)
    expect(result).toEqual({ ok: false, reason: 'already_assigned' })
  })

  it('surfaces the no_eligible_slot reason unchanged from validateAssignment', () => {
    const player = playerWithValuations({ id: 'test-qb', position: 'QB' })
    const slots = [slot({ id: 'wr', slotLabel: 'WR', eligiblePositions: ['WR'] })]
    const result = computeDraftResult(player, slots, ALL_TOGGLES_ON, [])
    expect(result).toEqual({ ok: false, reason: 'no_eligible_slot' })
  })

  it('surfaces the no_open_capacity reason unchanged from validateAssignment', () => {
    const player = playerWithValuations()
    const slots = [slot({ id: 'rb', slotLabel: 'RB', eligiblePositions: ['RB'], count: 1 })]
    const currentAssignments: RosterAssignment[] = [
      { slotInstanceId: 'rb-0', playerId: 'someone-else', pricePaid: 20 },
    ]
    const result = computeDraftResult(player, slots, ALL_TOGGLES_ON, currentAssignments)
    expect(result).toEqual({ ok: false, reason: 'no_open_capacity' })
  })
})

describe('removeAssignment', () => {
  it('removes the assignment belonging to the given player', () => {
    const assignments: RosterAssignment[] = [
      { slotInstanceId: 'regular-rb-0', playerId: 'p1', pricePaid: 55 },
      { slotInstanceId: 'regular-wr-0', playerId: 'p2', pricePaid: 40 },
    ]
    expect(removeAssignment(assignments, 'p1')).toEqual([
      { slotInstanceId: 'regular-wr-0', playerId: 'p2', pricePaid: 40 },
    ])
  })

  it('is a no-op when the player has no assignment', () => {
    const assignments: RosterAssignment[] = [
      { slotInstanceId: 'regular-rb-0', playerId: 'p1', pricePaid: 55 },
    ]
    expect(removeAssignment(assignments, 'someone-else')).toEqual(assignments)
  })

  it('does not mutate the input array', () => {
    const assignments: RosterAssignment[] = [
      { slotInstanceId: 'regular-rb-0', playerId: 'p1', pricePaid: 55 },
    ]
    removeAssignment(assignments, 'p1')
    expect(assignments).toHaveLength(1)
  })
})

describe('normalizePrice', () => {
  it('leaves an already-valid whole-dollar or $0.50 value unchanged', () => {
    expect(normalizePrice(43)).toBe(43)
    expect(normalizePrice(43.5)).toBe(43.5)
  })

  it('rounds to the nearest $0.50 increment', () => {
    expect(normalizePrice(9.2)).toBe(9)
    expect(normalizePrice(9.4)).toBe(9.5)
    // Exactly halfway between two increments rounds up, deterministically.
    expect(normalizePrice(9.25)).toBe(9.5)
  })

  it('enforces the $1 minimum', () => {
    expect(normalizePrice(0.5)).toBe(1)
    expect(normalizePrice(0)).toBe(1)
    expect(normalizePrice(-20)).toBe(1)
  })

  it('has no maximum — a very large value passes through untouched (rounded)', () => {
    expect(normalizePrice(9001)).toBe(9001)
  })

  it('clamps non-finite input to the minimum instead of propagating NaN', () => {
    expect(normalizePrice(NaN)).toBe(1)
    expect(normalizePrice(Infinity)).toBe(1)
  })
})

describe('updateAssignmentPrice', () => {
  const assignments: RosterAssignment[] = [
    { slotInstanceId: 'regular-rb-0', playerId: 'p1', pricePaid: 55 },
    { slotInstanceId: 'regular-wr-0', playerId: 'p2', pricePaid: 40 },
  ]

  it('updates only the assignment occupying the given slot', () => {
    const result = updateAssignmentPrice(assignments, 'regular-rb-0', 60)
    expect(result).toEqual([
      { slotInstanceId: 'regular-rb-0', playerId: 'p1', pricePaid: 60 },
      { slotInstanceId: 'regular-wr-0', playerId: 'p2', pricePaid: 40 },
    ])
  })

  it('normalizes the new price the same way normalizePrice does', () => {
    const result = updateAssignmentPrice(assignments, 'regular-rb-0', 9.25)
    expect(result.find((a) => a.slotInstanceId === 'regular-rb-0')?.pricePaid).toBe(9.5)
  })

  it('enforces the $1 minimum through the update path', () => {
    const result = updateAssignmentPrice(assignments, 'regular-rb-0', 0)
    expect(result.find((a) => a.slotInstanceId === 'regular-rb-0')?.pricePaid).toBe(1)
  })

  it('is a no-op when the slot is not currently occupied', () => {
    expect(updateAssignmentPrice(assignments, 'no-such-slot', 60)).toEqual(assignments)
  })

  it('does not mutate the input array', () => {
    updateAssignmentPrice(assignments, 'regular-rb-0', 60)
    expect(assignments[0].pricePaid).toBe(55)
  })

  it('recalculates spent/remaining through the same derivation path a fresh assignment uses', () => {
    // Guards against the price edit accidentally landing in separate local
    // state instead of the RosterAssignment[] that getSpent/getRemainingBudget
    // already sum over.
    const budget = 200
    const before = getSpent(assignments)
    expect(before).toBe(95)
    expect(getRemainingBudget(budget, assignments)).toBe(105)

    const edited = updateAssignmentPrice(assignments, 'regular-rb-0', 75)
    expect(getSpent(edited)).toBe(115) // 75 + 40
    expect(getRemainingBudget(budget, edited)).toBe(85)
  })
})

describe('clearAllAssignments', () => {
  const assignments: RosterAssignment[] = [
    { slotInstanceId: 'regular-rb-0', playerId: 'p1', pricePaid: 55 },
    { slotInstanceId: 'regular-wr-0', playerId: 'p2', pricePaid: 40 },
    { slotInstanceId: 'regular-qb-0', playerId: 'p3', pricePaid: 12 },
  ]

  it('removes every assignment', () => {
    expect(clearAllAssignments(assignments)).toEqual([])
  })

  it('is a no-op on an already-empty roster', () => {
    expect(clearAllAssignments([])).toEqual([])
  })

  it('does not mutate the input array', () => {
    clearAllAssignments(assignments)
    expect(assignments).toHaveLength(3)
  })

  it('recalculates spent/remaining to $0 spent / full budget through the same derivation path', () => {
    const budget = 200
    expect(getSpent(assignments)).toBe(107) // 55 + 40 + 12
    expect(getRemainingBudget(budget, assignments)).toBe(93)

    const cleared = clearAllAssignments(assignments)
    expect(getSpent(cleared)).toBe(0)
    expect(getRemainingBudget(budget, cleared)).toBe(budget)
  })
})
