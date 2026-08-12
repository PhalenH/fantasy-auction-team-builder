// Query layer for the standalone team list — not used by playerService.ts's
// join (that reads `team` directly in its own query), this is for callers
// that want a bare team list independent of any player data, e.g. a future
// "filter by team" dropdown.

import type { Pool } from 'pg'

import type { Team } from '../../src/types/Player'

interface TeamRow {
  code: string
  display_name: string
  bye_week: number
}

const TEAMS_SQL = `
  SELECT code, display_name, bye_week
  FROM team
  ORDER BY code
`

export async function getTeams(db: Pool): Promise<Team[]> {
  const { rows } = await db.query<TeamRow>(TEAMS_SQL)
  return rows.map((row) => ({
    code: row.code,
    displayName: row.display_name,
    byeWeek: row.bye_week,
  }))
}
