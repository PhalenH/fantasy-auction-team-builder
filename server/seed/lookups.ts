// The only seed data not read from src/data/, because it doesn't exist
// there: Position, ValuationSource, and Team live in the frontend purely as
// TypeScript types (PositionCode/ValuationSourceCode union types, and the
// Team interface itself, in src/types/Player.ts), which are erased at
// runtime, and no display names/bye weeks exist anywhere in src/.
//
// seed.ts guards against these drifting from the frontend by validating that
// every position code referenced by mockPlayers and by every roster slot's
// eligiblePositions appears below, aborting if one doesn't. Same for every
// team code mockPlayers references.
//
// Team display names and bye weeks below are the real 2026-2027 NFL
// schedule (server/ingestion/data/Bye_Weeks.csv) — the 32 teams/codes are
// effectively permanent, so there's no reason to use placeholder values
// here even though this is the mock/dev-fallback path. Real ingestion
// overwrites these on every run regardless (server/ingestion/run.ts).

import type { Position, Team, ValuationSource } from '../../src/types/Player'

export const positions: Position[] = [
  { code: 'QB', displayName: 'Quarterback' },
  { code: 'RB', displayName: 'Running Back' },
  { code: 'WR', displayName: 'Wide Receiver' },
  { code: 'TE', displayName: 'Tight End' },
  { code: 'K', displayName: 'Kicker' },
  { code: 'DST', displayName: 'Defense/Special Teams' },
]

export const valuationSources: ValuationSource[] = [
  { code: 'espn', displayName: 'ESPN' },
  { code: 'yahoo', displayName: 'Yahoo' },
]

export const teams: Team[] = [
  { code: 'ARI', displayName: 'Arizona Cardinals', byeWeek: 14 },
  { code: 'ATL', displayName: 'Atlanta Falcons', byeWeek: 11 },
  { code: 'BAL', displayName: 'Baltimore Ravens', byeWeek: 13 },
  { code: 'BUF', displayName: 'Buffalo Bills', byeWeek: 7 },
  { code: 'CAR', displayName: 'Carolina Panthers', byeWeek: 5 },
  { code: 'CHI', displayName: 'Chicago Bears', byeWeek: 10 },
  { code: 'CIN', displayName: 'Cincinnati Bengals', byeWeek: 6 },
  { code: 'CLE', displayName: 'Cleveland Browns', byeWeek: 11 },
  { code: 'DAL', displayName: 'Dallas Cowboys', byeWeek: 14 },
  { code: 'DEN', displayName: 'Denver Broncos', byeWeek: 10 },
  { code: 'DET', displayName: 'Detroit Lions', byeWeek: 6 },
  { code: 'GB', displayName: 'Green Bay Packers', byeWeek: 11 },
  { code: 'HOU', displayName: 'Houston Texans', byeWeek: 8 },
  { code: 'IND', displayName: 'Indianapolis Colts', byeWeek: 13 },
  { code: 'JAX', displayName: 'Jacksonville Jaguars', byeWeek: 7 },
  { code: 'KC', displayName: 'Kansas City Chiefs', byeWeek: 5 },
  { code: 'LAC', displayName: 'LA Chargers', byeWeek: 7 },
  { code: 'LAR', displayName: 'LA Rams', byeWeek: 11 },
  { code: 'LV', displayName: 'Las Vegas Raiders', byeWeek: 13 },
  { code: 'MIA', displayName: 'Miami Dolphins', byeWeek: 6 },
  { code: 'MIN', displayName: 'Minnesota Vikings', byeWeek: 6 },
  { code: 'NE', displayName: 'New England Patriots', byeWeek: 11 },
  { code: 'NO', displayName: 'New Orleans Saints', byeWeek: 8 },
  { code: 'NYG', displayName: 'NY Giants', byeWeek: 8 },
  { code: 'NYJ', displayName: 'NY Jets', byeWeek: 13 },
  { code: 'PHI', displayName: 'Philadelphia Eagles', byeWeek: 10 },
  { code: 'PIT', displayName: 'Pittsburgh Steelers', byeWeek: 9 },
  { code: 'SEA', displayName: 'Seattle Seahawks', byeWeek: 11 },
  { code: 'SF', displayName: 'San Francisco 49ers', byeWeek: 8 },
  { code: 'TB', displayName: 'Tampa Bay Buccaneers', byeWeek: 10 },
  { code: 'TEN', displayName: 'Tennessee Titans', byeWeek: 9 },
  { code: 'WAS', displayName: 'Washington Commanders', byeWeek: 7 },
]
