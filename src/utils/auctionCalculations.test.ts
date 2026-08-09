import { describe, expect, it } from 'vitest'
import { getCombinedAuctionValue } from './auctionCalculations'
import type { PlayerValuation } from '../types/Player'

function valuation(overrides: Partial<PlayerValuation> = {}): PlayerValuation {
  return {
    id: 'v1',
    playerId: 'p1',
    source: 'espn',
    auctionValue: 42,
    seasonYear: 2026,
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('getCombinedAuctionValue', () => {
  it('averages two sources (ESPN + Yahoo)', () => {
    const valuations = [
      valuation({ source: 'espn', auctionValue: 42 }),
      valuation({ source: 'yahoo', auctionValue: 45 }),
    ]
    expect(getCombinedAuctionValue(valuations)).toBe(43.5)
  })

  it('returns the single value when a source is missing', () => {
    const valuations = [valuation({ source: 'espn', auctionValue: 42 })]
    expect(getCombinedAuctionValue(valuations)).toBe(42)
  })

  it('averages more than two entries without assuming exactly espn + yahoo', () => {
    // The function only reads auctionValue — it never branches on `source`,
    // so it doesn't care how many distinct sources are represented.
    const valuations = [
      valuation({ id: 'v1', source: 'espn', auctionValue: 30 }),
      valuation({ id: 'v2', source: 'yahoo', auctionValue: 30 }),
      valuation({ id: 'v3', source: 'espn', auctionValue: 33 }),
    ]
    expect(getCombinedAuctionValue(valuations)).toBe(31)
  })

  it('rounds to the nearest cent instead of leaking floating-point noise', () => {
    const valuations = [
      valuation({ id: 'v1', auctionValue: 10 }),
      valuation({ id: 'v2', auctionValue: 10 }),
      valuation({ id: 'v3', auctionValue: 11 }),
    ]
    expect(getCombinedAuctionValue(valuations)).toBe(10.33)
  })

  it('returns null when there is no valuation data at all', () => {
    expect(getCombinedAuctionValue([])).toBeNull()
  })
})
