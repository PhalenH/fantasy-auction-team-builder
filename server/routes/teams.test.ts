// Integration tests against the REAL seeded local Postgres.
// Requires: docker compose up -d && npm run db:reset

import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'

import type { Team } from '../../src/types/Player'
import { createApp } from '../app'
import { pool } from '../db/pool'
import { teams as seededTeams } from '../seed/lookups'

const app = createApp(pool)

afterAll(async () => {
  await pool.end()
})

async function fetchTeams(): Promise<Team[]> {
  const response = await request(app).get('/api/teams')
  expect(response.status).toBe(200)
  return response.body as Team[]
}

describe('GET /api/teams', () => {
  it('returns all 32 seeded teams', async () => {
    const teams = await fetchTeams()
    expect(teams).toHaveLength(32)
  })

  it('matches the seed data for a known team', async () => {
    const teams = await fetchTeams()
    const kc = seededTeams.find((team) => team.code === 'KC')!

    expect(teams.find((team) => team.code === 'KC')).toEqual(kc)
  })

  it('returns scalar fields with the types the frontend declares', async () => {
    const [team] = await fetchTeams()
    expect(typeof team.code).toBe('string')
    expect(typeof team.displayName).toBe('string')
    expect(typeof team.byeWeek).toBe('number')
  })

  it('does not leak database column names into the payload', async () => {
    const [team] = await fetchTeams()
    expect(team).not.toHaveProperty('display_name')
    expect(team).not.toHaveProperty('bye_week')
  })
})
