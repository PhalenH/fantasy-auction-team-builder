import { describe, expect, it } from 'vitest'
import { buildSavedRosterAssignments, sortSavedRosterAssignments } from './savedRoster'
import { rosterPositionSlots } from '../data/leagueFormats'
import type { RosterAssignment, SavedRosterAssignment } from '../types/Roster'
import type { PlayerWithValuations } from '../types/Player'
import type { ToggleState } from './rosterAssignment'

const ALL_TOGGLES_ON: ToggleState = { kickerEnabled: true, defenseEnabled: true }
const regularSlots = rosterPositionSlots.filter((s) => s.leagueFormatId === 'regular')

function player(overrides: Partial<PlayerWithValuations> = {}): PlayerWithValuations {
  return {
    id: 'p1',
    name: 'Test Runningback',
    teamCode: 'TST',
    teamDisplayName: 'Test Team',
    position: 'RB',
    byeWeek: 5,
    valuations: [],
    ...overrides,
  }
}

describe('buildSavedRosterAssignments', () => {
  it('denormalizes name/team/position from the live player pool', () => {
    const assignments: RosterAssignment[] = [
      { slotInstanceId: 'regular-rb-0', playerId: 'p1', pricePaid: 42 },
    ]
    const result = buildSavedRosterAssignments(assignments, regularSlots, ALL_TOGGLES_ON, [player()])

    expect(result).toEqual([
      {
        slotLabel: 'RB',
        slotInstanceId: 'regular-rb-0',
        playerId: 'p1',
        playerName: 'Test Runningback',
        playerTeam: 'TST',
        playerPosition: 'RB',
        pricePaid: 42,
      },
    ])
  })

  it('falls back to the assignment unresolvedPlayer snapshot when the player is not in the live pool', () => {
    const assignments: RosterAssignment[] = [
      {
        slotInstanceId: 'regular-wr-0',
        playerId: 'ghost',
        pricePaid: 12,
        unresolvedPlayer: { name: 'Old Timer', teamCode: 'OLD', position: 'WR' },
      },
    ]
    const result = buildSavedRosterAssignments(assignments, regularSlots, ALL_TOGGLES_ON, [])

    expect(result).toEqual([
      {
        slotLabel: 'WR',
        slotInstanceId: 'regular-wr-0',
        playerId: 'ghost',
        playerName: 'Old Timer',
        playerTeam: 'OLD',
        playerPosition: 'WR',
        pricePaid: 12,
      },
    ])
  })

  it('skips an assignment that resolves to neither a live player nor a snapshot', () => {
    const assignments: RosterAssignment[] = [{ slotInstanceId: 'regular-rb-0', playerId: 'nobody', pricePaid: 5 }]
    expect(buildSavedRosterAssignments(assignments, regularSlots, ALL_TOGGLES_ON, [])).toEqual([])
  })

  it('preserves multiple assignments in order', () => {
    const assignments: RosterAssignment[] = [
      { slotInstanceId: 'regular-rb-0', playerId: 'p1', pricePaid: 10 },
      { slotInstanceId: 'regular-rb-1', playerId: 'p2', pricePaid: 20 },
    ]
    const players = [player(), player({ id: 'p2', name: 'Second Back' })]
    const result = buildSavedRosterAssignments(assignments, regularSlots, ALL_TOGGLES_ON, players)

    expect(result.map((a) => a.playerName)).toEqual(['Test Runningback', 'Second Back'])
  })
})

function savedAssignment(overrides: Partial<SavedRosterAssignment> = {}): SavedRosterAssignment {
  return {
    slotLabel: 'RB',
    slotInstanceId: 'regular-rb-0',
    playerId: 'p1',
    playerName: 'Test Runningback',
    playerTeam: 'TST',
    playerPosition: 'RB',
    pricePaid: 10,
    ...overrides,
  }
}

describe('sortSavedRosterAssignments', () => {
  it('reorders draft-order assignments into canonical slot order (QB, RB, RB, WR, WR, TE, FLEX, DST, BENCH)', () => {
    // Deliberately built out of order, as if drafted WR before QB before RB.
    const assignments = [
      savedAssignment({ slotInstanceId: 'regular-wr-1', slotLabel: 'WR', playerName: 'WR Two' }),
      savedAssignment({ slotInstanceId: 'regular-dst', slotLabel: 'DST', playerName: 'Defense' }),
      savedAssignment({ slotInstanceId: 'regular-qb-0', slotLabel: 'QB', playerName: 'QB One' }),
      savedAssignment({ slotInstanceId: 'regular-rb-1', slotLabel: 'RB', playerName: 'RB Two' }),
      savedAssignment({ slotInstanceId: 'regular-wr-0', slotLabel: 'WR', playerName: 'WR One' }),
      savedAssignment({ slotInstanceId: 'regular-rb-0', slotLabel: 'RB', playerName: 'RB One' }),
    ]

    const result = sortSavedRosterAssignments(assignments, regularSlots, ALL_TOGGLES_ON)

    expect(result.map((a) => a.playerName)).toEqual([
      'QB One',
      'RB One',
      'RB Two',
      'WR One',
      'WR Two',
      'Defense',
    ])
  })

  it('uses the toggle state to decide whether K/DST slots are ordered in at all', () => {
    const assignments = [
      savedAssignment({ slotInstanceId: 'regular-dst', slotLabel: 'DST', playerName: 'Defense' }),
      savedAssignment({ slotInstanceId: 'regular-qb-0', slotLabel: 'QB', playerName: 'QB One' }),
    ]
    const togglesOff: ToggleState = { kickerEnabled: false, defenseEnabled: false }

    // DST has no matching active slot when the toggle is off, so it sorts
    // last (via the Infinity fallback) rather than erroring.
    const result = sortSavedRosterAssignments(assignments, regularSlots, togglesOff)
    expect(result.map((a) => a.playerName)).toEqual(['QB One', 'Defense'])
  })

  it('does not mutate the input array', () => {
    const assignments = [
      savedAssignment({ slotInstanceId: 'regular-rb-1', slotLabel: 'RB', playerName: 'RB Two' }),
      savedAssignment({ slotInstanceId: 'regular-rb-0', slotLabel: 'RB', playerName: 'RB One' }),
    ]
    sortSavedRosterAssignments(assignments, regularSlots, ALL_TOGGLES_ON)
    expect(assignments.map((a) => a.playerName)).toEqual(['RB Two', 'RB One'])
  })
})
