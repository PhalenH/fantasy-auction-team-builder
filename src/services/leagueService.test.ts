// Smoke test — confirms getLeagueFormats() resolves the expected joined
// shape (each format with its roster slots embedded), matching
// data/leagueFormats.ts and docs/datamodel.md.

import { describe, expect, it } from 'vitest'
import { getLeagueFormats } from './leagueService'
import { leagueFormats, rosterPositionSlots } from '../data/leagueFormats'

describe('getLeagueFormats', () => {
  it('resolves a promise (async even over static mock data)', () => {
    expect(getLeagueFormats()).toBeInstanceOf(Promise)
  })

  it('returns all three finalized formats with their slots embedded', async () => {
    const result = await getLeagueFormats()
    expect(result).toHaveLength(leagueFormats.length)
    expect(result.map((f) => f.key)).toEqual(['regular', 'regular_3wr', 'double_flex'])

    const regular = result.find((f) => f.key === 'regular')!
    expect(regular.slots).toEqual(
      rosterPositionSlots.filter((s) => s.leagueFormatId === 'regular'),
    )
    expect(regular.slots.map((s) => s.slotLabel)).toEqual([
      'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DST', 'BENCH',
    ])
  })
})
