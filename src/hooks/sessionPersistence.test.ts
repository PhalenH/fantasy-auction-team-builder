// sessionStorage is cleared between tests globally (src/vitest.setup.ts),
// so no per-file setup is needed here.

import { describe, expect, it, vi } from 'vitest'
import { readPersistedSession, writePersistedSessionSlice } from './sessionPersistence'

const STORAGE_KEY = 'draftSession'

describe('readPersistedSession / writePersistedSessionSlice round trip', () => {
  it('returns null when nothing has been stored yet', () => {
    expect(readPersistedSession()).toBeNull()
  })

  it('round-trips a full session written across several slice writes', () => {
    writePersistedSessionSlice({
      leagueFormatId: 'regular',
      budget: 200,
      kickerEnabled: false,
      defenseEnabled: true,
    })
    writePersistedSessionSlice({
      assignments: [{ slotInstanceId: 'regular-rb-0', playerId: 'p1', pricePaid: 55 }],
    })
    writePersistedSessionSlice({ favoriteIds: ['p1', 'p2'] })

    expect(readPersistedSession()).toEqual({
      leagueFormatId: 'regular',
      budget: 200,
      kickerEnabled: false,
      defenseEnabled: true,
      assignments: [{ slotInstanceId: 'regular-rb-0', playerId: 'p1', pricePaid: 55 }],
      favoriteIds: ['p1', 'p2'],
    })
  })

  it('a later slice write does not clobber fields written by an earlier one', () => {
    // A full session first (mirrors every hook having mounted and written
    // its own slice at least once), then a partial update from just one
    // hook — the fields it didn't touch must survive untouched.
    writePersistedSessionSlice({
      leagueFormatId: 'double_flex',
      budget: 250,
      kickerEnabled: true,
      defenseEnabled: true,
      assignments: [],
      favoriteIds: [],
    })
    writePersistedSessionSlice({ favoriteIds: ['p9'] })

    const result = readPersistedSession()
    expect(result?.leagueFormatId).toBe('double_flex')
    expect(result?.budget).toBe(250)
    expect(result?.favoriteIds).toEqual(['p9'])
  })
})

describe('readPersistedSession corrupted/invalid data handling', () => {
  it('returns null for unparseable JSON', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(readPersistedSession()).toBeNull()
  })

  it('returns null when the stored value is not an object at all', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]))
    expect(readPersistedSession()).toBeNull()
  })

  it('returns null when a top-level scalar field has the wrong type', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        leagueFormatId: 'regular',
        budget: 'two hundred', // should be a number
        kickerEnabled: true,
        defenseEnabled: true,
        assignments: [],
        favoriteIds: [],
      }),
    )
    expect(readPersistedSession()).toBeNull()
  })

  it('returns null when assignments/favoriteIds are missing entirely', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ leagueFormatId: 'regular', budget: 200, kickerEnabled: true, defenseEnabled: true }),
    )
    expect(readPersistedSession()).toBeNull()
  })

  it('drops an individual malformed assignment instead of failing the whole session', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        leagueFormatId: 'regular',
        budget: 200,
        kickerEnabled: true,
        defenseEnabled: true,
        assignments: [
          { slotInstanceId: 'regular-rb-0', playerId: 'p1', pricePaid: 55 },
          { slotInstanceId: 'regular-wr-0', playerId: 'p2' }, // missing pricePaid
          'not even an object',
        ],
        favoriteIds: [],
      }),
    )

    expect(readPersistedSession()).toEqual({
      leagueFormatId: 'regular',
      budget: 200,
      kickerEnabled: true,
      defenseEnabled: true,
      assignments: [{ slotInstanceId: 'regular-rb-0', playerId: 'p1', pricePaid: 55 }],
      favoriteIds: [],
    })
  })

  it('drops an individual non-string favoriteId instead of failing the whole session', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        leagueFormatId: 'regular',
        budget: 200,
        kickerEnabled: true,
        defenseEnabled: true,
        assignments: [],
        favoriteIds: ['p1', 42, null],
      }),
    )

    expect(readPersistedSession()?.favoriteIds).toEqual(['p1'])
  })
})

describe('writePersistedSessionSlice failure tolerance', () => {
  it('does not throw when sessionStorage.setItem throws (e.g. private browsing, quota)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => writePersistedSessionSlice({ budget: 200 })).not.toThrow()

    setItemSpy.mockRestore()
  })
})
