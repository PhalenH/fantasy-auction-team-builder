// GET /api/players — read-only. Thin by design: no parsing, no logic, no
// SQL. It calls the query layer and serializes the result.
//
// The pool is injected rather than imported so the route has no module-level
// state and tests can point it at a different database.

import { Router } from 'express'
import type { Pool } from 'pg'

import { getPlayers } from '../services/playerService'

export function createPlayersRouter(db: Pool): Router {
  const router = Router()

  // Express 5 forwards a rejected promise to the error handler on its own,
  // so no try/catch or asyncHandler wrapper is needed here.
  router.get('/', async (_req, res) => {
    res.json(await getPlayers(db))
  })

  return router
}
