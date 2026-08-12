// Parses the bye-week CSV: `Team` (full name), `Bye Week` (int) — one row
// per NFL team. This source has no 3-letter team codes, only full names, so
// TEAM_NAME_TO_CODE below is the one place that bridges it to the codes the
// auction-value source (and Player.team_code) actually use. The 32 teams
// are effectively permanent, so a hardcoded map here carries no more
// maintenance risk than the codes baked into the auction-value CSV itself.

import { readFileSync } from 'node:fs'

import { parseCsv } from '../csv'

export interface ByeWeekRow {
  code: string
  displayName: string
  byeWeek: number
}

const TEAM_NAME_TO_CODE: Record<string, string> = {
  'Arizona Cardinals': 'ARI',
  'Atlanta Falcons': 'ATL',
  'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR',
  'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC',
  'LA Chargers': 'LAC',
  'LA Rams': 'LAR',
  'Las Vegas Raiders': 'LV',
  'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'NY Giants': 'NYG',
  'NY Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI',
  'Pittsburgh Steelers': 'PIT',
  'Seattle Seahawks': 'SEA',
  'San Francisco 49ers': 'SF',
  'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN',
  'Washington Commanders': 'WAS',
}

export function parseByeWeeks(filePath: string): ByeWeekRow[] {
  const [, ...rows] = parseCsv(readFileSync(filePath, 'utf8'))

  return rows.map((row, index) => {
    const lineNumber = index + 2
    const [displayName, byeWeekRaw] = row

    const code = TEAM_NAME_TO_CODE[displayName]
    if (!code) {
      throw new Error(`${filePath}:${lineNumber}: no team code mapping for "${displayName}"`)
    }

    const byeWeek = Number(byeWeekRaw)
    if (!Number.isInteger(byeWeek)) {
      throw new Error(`${filePath}:${lineNumber}: non-integer bye week "${byeWeekRaw}" for "${displayName}"`)
    }

    return { code, displayName, byeWeek }
  })
}
