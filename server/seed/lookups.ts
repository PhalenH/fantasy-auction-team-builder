// The only seed data not read from src/data/, because it doesn't exist
// there: Position and ValuationSource live in the frontend purely as the
// TypeScript union types PositionCode/ValuationSourceCode (src/types/Player.ts),
// which are erased at runtime, and no display names exist anywhere in src/.
//
// seed.ts guards against these drifting from the frontend by validating that
// every position code referenced by mockPlayers and by every roster slot's
// eligiblePositions appears below, aborting if one doesn't.

import type { Position, ValuationSource } from '../../src/types/Player'

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
