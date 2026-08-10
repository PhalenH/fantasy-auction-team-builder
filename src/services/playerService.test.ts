// Confirms getPlayers() calls the real API endpoint through the Vite proxy
// path and passes the response through unchanged. Fetch is stubbed, so this
// needs neither the Express server nor Postgres — the `server` test project
// covers the live round trip.

import { beforeEach, describe, expect, it } from 'vitest'
import { getPlayers } from './playerService'
import { mockApi, mockApiErrorResponse, playersPayload } from '../test/apiMock'
import { players } from '../data/mockPlayers'

describe('getPlayers', () => {
  beforeEach(() => {
    mockApi()
  })

  it('requests a relative /api path so the Vite dev proxy handles it', async () => {
    await getPlayers()
    // A hardcoded http://localhost:3001 would break the proxy setup and any
    // non-dev deployment.
    expect(fetch).toHaveBeenCalledWith('/api/players')
  })

  it('resolves the players with their valuations embedded', async () => {
    const result = await getPlayers()

    expect(result).toHaveLength(players.length)
    expect(result).toEqual(playersPayload)

    const mahomes = result.find((player) => player.name === 'Patrick Mahomes')!
    expect(mahomes.valuations.map((valuation) => valuation.auctionValue)).toEqual([42, 45])
  })

  it('does not attach a precomputed combined value', async () => {
    const [player] = await getPlayers()
    expect(player).not.toHaveProperty('combinedValue')
    expect(player).not.toHaveProperty('auctionValue')
  })

  it('rejects rather than resolving an error body as if it were players', async () => {
    mockApiErrorResponse()
    await expect(getPlayers()).rejects.toThrow(/Could not load players \(HTTP 503\)/)
  })
})
