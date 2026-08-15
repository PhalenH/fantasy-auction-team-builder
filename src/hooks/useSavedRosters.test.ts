// localStorage isn't cleared globally between tests the way sessionStorage
// is (see src/vitest.setup.ts), so each test clears it itself.

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addSavedRoster,
  MAX_SAVED_ROSTERS,
  overwriteSavedRoster,
  readSavedRosters,
  removeSavedRoster,
  resolveSaveName,
  updateSavedRosterName,
} from './useSavedRosters'
import type { SavedRoster } from '../types/Roster'

const STORAGE_KEY = 'savedRosters'

afterEach(() => {
  localStorage.clear()
})

function savedRoster(overrides: Partial<SavedRoster> = {}): SavedRoster {
  return {
    id: 'save-1',
    name: 'My Draft',
    savedAt: '2026-08-01T00:00:00Z',
    leagueFormatKey: 'regular',
    budget: 200,
    defenseEnabled: true,
    kickerEnabled: true,
    totalSpent: 150,
    remainingBudget: 50,
    assignments: [
      {
        slotLabel: 'RB',
        slotInstanceId: 'regular-rb-0',
        playerId: 'p1',
        playerName: 'Test Runningback',
        playerTeam: 'TST',
        playerPosition: 'RB',
        pricePaid: 55,
      },
    ],
    ...overrides,
  }
}

describe('addSavedRoster / overwriteSavedRoster / removeSavedRoster', () => {
  it('addSavedRoster appends without mutating the input', () => {
    const existing = [savedRoster({ id: 'a' })]
    const result = addSavedRoster(existing, savedRoster({ id: 'b' }))
    expect(result.map((r) => r.id)).toEqual(['a', 'b'])
    expect(existing).toHaveLength(1)
  })

  it('overwriteSavedRoster replaces only the matching entry, in place', () => {
    const existing = [savedRoster({ id: 'a', name: 'First' }), savedRoster({ id: 'b', name: 'Second' })]
    const result = overwriteSavedRoster(existing, 'a', savedRoster({ id: 'a', name: 'Renamed' }))
    expect(result.map((r) => r.name)).toEqual(['Renamed', 'Second'])
  })

  it('overwriteSavedRoster is a no-op when the id is not found', () => {
    const existing = [savedRoster({ id: 'a' })]
    expect(overwriteSavedRoster(existing, 'no-such-id', savedRoster({ id: 'no-such-id' }))).toEqual(existing)
  })

  it('removeSavedRoster filters by id', () => {
    const existing = [savedRoster({ id: 'a' }), savedRoster({ id: 'b' })]
    expect(removeSavedRoster(existing, 'a').map((r) => r.id)).toEqual(['b'])
  })

  it('removeSavedRoster is a no-op when the id is not found', () => {
    const existing = [savedRoster({ id: 'a' })]
    expect(removeSavedRoster(existing, 'no-such-id')).toEqual(existing)
  })
})

describe('updateSavedRosterName', () => {
  it('updates only the name of the matching entry, in place', () => {
    const existing = [savedRoster({ id: 'a', name: 'First' }), savedRoster({ id: 'b', name: 'Second' })]
    const result = updateSavedRosterName(existing, 'a', 'Renamed')
    expect(result.map((r) => r.name)).toEqual(['Renamed', 'Second'])
    expect(result.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('leaves every other field untouched', () => {
    const existing = [savedRoster({ id: 'a' })]
    const [result] = updateSavedRosterName(existing, 'a', 'Renamed')
    expect(result).toEqual({ ...existing[0], name: 'Renamed' })
  })

  it('is a no-op when the id is not found', () => {
    const existing = [savedRoster({ id: 'a' })]
    expect(updateSavedRosterName(existing, 'no-such-id', 'Renamed')).toEqual(existing)
  })

  it('does not mutate the input array', () => {
    const existing = [savedRoster({ id: 'a', name: 'First' })]
    updateSavedRosterName(existing, 'a', 'Renamed')
    expect(existing[0].name).toBe('First')
  })
})

describe('readSavedRosters', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(readSavedRosters()).toEqual([])
  })

  it('round-trips a stored list', () => {
    const rosters = [savedRoster({ id: 'a' }), savedRoster({ id: 'b' })]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rosters))
    expect(readSavedRosters()).toEqual(rosters)
  })

  it('falls back to an empty list for unparseable JSON, without throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(() => readSavedRosters()).not.toThrow()
    expect(readSavedRosters()).toEqual([])
  })

  it('falls back to an empty list when the stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }))
    expect(readSavedRosters()).toEqual([])
  })

  it('drops an individual malformed entry instead of failing the whole list', () => {
    const good = savedRoster({ id: 'a' })
    const bad = { id: 'b', name: 'Missing everything else' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([good, bad]))
    expect(readSavedRosters()).toEqual([good])
  })

  it('drops an entry whose assignments array contains a malformed row', () => {
    const bad = savedRoster({
      id: 'b',
      assignments: [{ slotLabel: 'RB', slotInstanceId: 'x', playerId: 'p1' } as never],
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify([bad]))
    expect(readSavedRosters()).toEqual([])
  })
})

describe('localStorage write-failure tolerance', () => {
  it('reading does not throw even when localStorage itself throws', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => readSavedRosters()).not.toThrow()
    expect(readSavedRosters()).toEqual([])
    getItemSpy.mockRestore()
  })
})

describe('resolveSaveName', () => {
  it('uses the trimmed raw name when one was entered', () => {
    expect(resolveSaveName('Hero RB build', 'Draft — 8/14/2026', [])).toBe('Hero RB build')
    expect(resolveSaveName('  Padded  ', 'Draft — 8/14/2026', [])).toBe('Padded')
  })

  it('falls back to the default name when the input is blank or whitespace-only', () => {
    expect(resolveSaveName('', 'Draft — 8/14/2026', [])).toBe('Draft — 8/14/2026')
    expect(resolveSaveName('   ', 'Draft — 8/14/2026', [])).toBe('Draft — 8/14/2026')
  })

  it('disambiguates the default name against a collision with a numbered suffix', () => {
    expect(resolveSaveName('', 'Draft — 8/14/2026', ['Draft — 8/14/2026'])).toBe('Draft — 8/14/2026 (2)')
  })

  it('keeps incrementing the suffix past existing numbered collisions', () => {
    const existing = ['Draft — 8/14/2026', 'Draft — 8/14/2026 (2)', 'Draft — 8/14/2026 (3)']
    expect(resolveSaveName('', 'Draft — 8/14/2026', existing)).toBe('Draft — 8/14/2026 (4)')
  })

  it('does not disambiguate an explicitly-entered name, even if it collides', () => {
    // A collision on a name the user actually typed is their call, not
    // something to silently rewrite — only the blank/default fallback path
    // needs disambiguation.
    expect(resolveSaveName('My Draft', 'Draft — 8/14/2026', ['My Draft'])).toBe('My Draft')
  })
})

describe('MAX_SAVED_ROSTERS', () => {
  it('is 6, per docs/saved_rosters_plan.md', () => {
    expect(MAX_SAVED_ROSTERS).toBe(6)
  })
})
