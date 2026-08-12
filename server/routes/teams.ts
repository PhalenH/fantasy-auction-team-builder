// GET /api/teams — read-only. Same shape as leagueFormats.ts/players.ts:
// inject the pool, call the query layer, serialize.

import { Router } from 'express'
import type { Pool } from 'pg'

import { getTeams } from '../services/teamService'

export function createTeamsRouter(db: Pool): Router {
  const router = Router()

  router.get('/', async (_req, res) => {
    res.json(await getTeams(db))
  })

  return router
}
