// GET /api/league-formats — read-only. Same shape as players.ts: inject the
// pool, call the query layer, serialize.

import { Router } from 'express'
import type { Pool } from 'pg'

import { getLeagueFormats } from '../services/leagueService'

export function createLeagueFormatsRouter(db: Pool): Router {
  const router = Router()

  router.get('/', async (_req, res) => {
    res.json(await getLeagueFormats(db))
  })

  return router
}
