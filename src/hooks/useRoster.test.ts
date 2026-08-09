// Tests target computeDraftResult directly — the pure function useRoster
// wraps in useState — so the draft-decision logic is verified without
// rendering a component or a hook-testing library.

import { describe, expect, it } from 'vitest'
import { computeDraftResult, removeAssignment } from './useRoster'
import { getCombinedAuctionValue } from '../utils/auctionCalculations'
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
    nflTeam: 'TST',
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
