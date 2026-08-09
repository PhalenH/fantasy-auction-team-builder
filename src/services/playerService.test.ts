// Smoke tests — there's no real logic in this service yet, just confirming
// it resolves the expected shape (mock players with valuations embedded,
// no precomputed combined value) as documented in CLAUDE.md's Frontend
// Structure notes.

import { describe, expect, it } from 'vitest'
import { getPlayers } from './playerService'
import { players, playerValuations } from '../data/mockPlayers'

describe('getPlayers', () => {
  it('resolves a promise (async even over static mock data)', () => {
    expect(getPlayers()).toBeInstanceOf(Promise)
  })

  it('returns every mock player with its valuations embedded', async () => {
    const result = await getPlayers()
    expect(result).toHaveLength(players.length)

    const mahomes = result.find((p) => p.id === 'p1')!
    expect(mahomes.name).toBe('Patrick Mahomes')
    expect(mahomes.valuations).toEqual(
      playerValuations.filter((v) => v.playerId === 'p1'),
    )
  })

  it('does not attach a precomputed combined value', async () => {
    const [player] = await getPlayers()
    expect(player).not.toHaveProperty('combinedValue')
    expect(player).not.toHaveProperty('auctionValue')
  })
})
