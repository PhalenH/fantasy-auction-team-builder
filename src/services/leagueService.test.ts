// Confirms getLeagueFormats() calls the real API endpoint and passes the
// response through unchanged. Fetch is stubbed — no server or database
// needed.

import { beforeEach, describe, expect, it } from 'vitest'
import { getLeagueFormats } from './leagueService'
import { leagueFormatsPayload, mockApi, mockApiErrorResponse } from '../test/apiMock'
import { leagueFormats, rosterPositionSlots } from '../data/leagueFormats'

describe('getLeagueFormats', () => {
  beforeEach(() => {
    mockApi()
  })

  it('requests a relative /api path so the Vite dev proxy handles it', async () => {
    await getLeagueFormats()
    expect(fetch).toHaveBeenCalledWith('/api/league-formats')
  })

  it('resolves all three finalized formats with their slots embedded', async () => {
    const result = await getLeagueFormats()

    expect(result).toHaveLength(leagueFormats.length)
    expect(result.map((format) => format.key)).toEqual(['regular', 'regular_3wr', 'double_flex'])
    expect(result).toEqual(leagueFormatsPayload)

    const regular = result.find((format) => format.key === 'regular')!
    expect(regular.slots).toEqual(rosterPositionSlots.filter((slot) => slot.leagueFormatId === 'regular'))
    expect(regular.slots.map((slot) => slot.slotLabel)).toEqual([
      'QB',
      'RB',
      'WR',
      'TE',
      'FLEX',
      'K',
      'DST',
      'BENCH',
    ])
  })

  it('rejects rather than resolving an error body as if it were formats', async () => {
    mockApiErrorResponse()
    await expect(getLeagueFormats()).rejects.toThrow(/Could not load league formats \(HTTP 503\)/)
  })
})
