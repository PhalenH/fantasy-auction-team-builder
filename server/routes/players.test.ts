// Integration tests against the REAL seeded local Postgres — no mocked pg.
// The point is to prove the wire format the frontend will consume next pass,
// which a mock could not do (the NUMERIC-as-string trap below only exists
// because of the real driver).
//
// Requires: docker compose up -d && npm run db:reset

import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'

import type { PlayerWithValuations } from '../../src/types/Player'
import { createApp } from '../app'
import { pool } from '../db/pool'
import { teams } from '../seed/lookups'

const app = createApp(pool)

afterAll(async () => {
  await pool.end()
})

async function fetchPlayers(): Promise<PlayerWithValuations[]> {
  const response = await request(app).get('/api/players')
  expect(response.status).toBe(200)
  return response.body as PlayerWithValuations[]
}

describe('GET /api/players', () => {
  it('returns every seeded player', async () => {
    const players = await fetchPlayers()
    expect(players).toHaveLength(20)
  })

  it('embeds each player’s valuations, matching the CLAUDE.md worked example', async () => {
    const players = await fetchPlayers()
    const mahomes = players.find((player) => player.name === 'Patrick Mahomes')
    // byeWeek/teamDisplayName come from the team join, not a Player column —
    // cross-checked against lookups.ts rather than a magic number so this
    // test doesn't silently drift if the KC bye week changes there.
    const kc = teams.find((team) => team.code === 'KC')!

    expect(mahomes).toBeDefined()
    expect(mahomes).toMatchObject({
      teamCode: 'KC',
      teamDisplayName: kc.displayName,
      position: 'QB',
      byeWeek: kc.byeWeek,
    })
    expect(mahomes!.valuations).toHaveLength(2)

    const bySource = Object.fromEntries(mahomes!.valuations.map((v) => [v.source, v.auctionValue]))
    expect(bySource).toEqual({ espn: 42, yahoo: 45 })
  })

  it('returns auctionValue as a number, not the string pg gives back for NUMERIC', async () => {
    const players = await fetchPlayers()
    const valuations = players.flatMap((player) => player.valuations)

    expect(valuations).toHaveLength(40)
    for (const valuation of valuations) {
      expect(typeof valuation.auctionValue).toBe('number')
    }

    // Explicitly pin the trap: unconverted, this would be the string '42.00'.
    const espnMahomes = players
      .find((player) => player.name === 'Patrick Mahomes')!
      .valuations.find((valuation) => valuation.source === 'espn')!
    expect(espnMahomes.auctionValue).toBe(42)
    expect(espnMahomes.auctionValue).not.toBe('42.00')
  })

  it('returns scalar fields with the types the frontend declares', async () => {
    const [player] = await fetchPlayers()

    expect(typeof player.id).toBe('string')
    expect(typeof player.byeWeek).toBe('number')

    const [valuation] = player.valuations
    expect(typeof valuation.id).toBe('string')
    expect(typeof valuation.playerId).toBe('string')
    expect(typeof valuation.seasonYear).toBe('number')
    // TIMESTAMPTZ comes back as a Date from pg; the type declares a string.
    expect(typeof valuation.updatedAt).toBe('string')
    expect(new Date(valuation.updatedAt).getUTCFullYear()).toBe(2026)
  })

  it('links every valuation to its own player', async () => {
    const players = await fetchPlayers()
    for (const player of players) {
      for (const valuation of player.valuations) {
        expect(valuation.playerId).toBe(player.id)
      }
    }
  })

  it('does not attach a precomputed combined value', async () => {
    const players = await fetchPlayers()
    // Mirrors the same assertion in src/services/playerService.test.ts —
    // combined value stays derived client-side by auctionCalculations.ts.
    for (const player of players) {
      expect(player).not.toHaveProperty('combinedValue')
      expect(player).not.toHaveProperty('auctionValue')
      expect(player).not.toHaveProperty('combinedAuctionValue')
    }
  })

  it('omits unpopulated external ids rather than sending null', async () => {
    const players = await fetchPlayers()
    // The frontend type declares these optional (string | undefined), so a
    // NULL column must not surface as null on the wire.
    for (const player of players) {
      expect(player).not.toHaveProperty('espnPlayerId')
      expect(player).not.toHaveProperty('yahooPlayerId')
    }
  })

  it('does not leak database column names into the payload', async () => {
    const [player] = await fetchPlayers()
    expect(player).not.toHaveProperty('nfl_team')
    expect(player).not.toHaveProperty('team_code')
    expect(player).not.toHaveProperty('team_display_name')
    expect(player).not.toHaveProperty('position_code')
    expect(player).not.toHaveProperty('bye_week')
  })
})
