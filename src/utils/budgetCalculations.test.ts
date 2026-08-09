import { describe, expect, it } from 'vitest'
import { getSpent, getRemainingBudget } from './budgetCalculations'
import type { RosterAssignment } from '../types/Roster'

function assignment(overrides: Partial<RosterAssignment> = {}): RosterAssignment {
  return {
    slotInstanceId: 'regular-rb-0',
    playerId: 'p1',
    pricePaid: 10,
    ...overrides,
  }
}

describe('getSpent', () => {
  it('is zero with no roster assignments', () => {
    expect(getSpent([])).toBe(0)
  })

  it('sums pricePaid across assignments', () => {
    const assignments = [
      assignment({ playerId: 'p1', pricePaid: 45 }),
      assignment({ playerId: 'p2', pricePaid: 55 }),
      assignment({ playerId: 'p3', pricePaid: 17 }),
    ]
    expect(getSpent(assignments)).toBe(117)
  })
})

describe('getRemainingBudget', () => {
  it('equals the full budget at zero spend', () => {
    expect(getRemainingBudget(200, [])).toBe(200)
  })

  it('is zero when spend exactly matches the budget', () => {
    const assignments = [
      assignment({ playerId: 'p1', pricePaid: 120 }),
      assignment({ playerId: 'p2', pricePaid: 80 }),
    ]
    expect(getRemainingBudget(200, assignments)).toBe(0)
  })

  it('goes negative on overspend rather than clamping to zero', () => {
    const assignments = [assignment({ playerId: 'p1', pricePaid: 250 })]
    expect(getRemainingBudget(200, assignments)).toBe(-50)
  })
})
