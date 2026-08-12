// Parses the weekly auction-value CSV: `Player, Position, Team, ESPN ADP,
// Yahoo ADP`. Despite the column header, these are dollar auction values,
// not draft-position ADP (confirmed — see docs/datamodel.md, "Real
// ingestion"), so the parsed field names below say what the values actually
// are rather than propagating the source's misleading header text.

import { readFileSync } from 'node:fs'

import { parseCsv } from '../csv'
import type { PositionCode } from '../../../src/types/Player'

export interface AuctionValueRow {
  name: string
  position: PositionCode
  teamCode: string
  espnValue: number
  yahooValue: number
}

const VALID_POSITIONS = new Set<PositionCode>(['QB', 'RB', 'WR', 'TE', 'K', 'DST'])

export function parseAuctionValues(filePath: string): AuctionValueRow[] {
  const [, ...rows] = parseCsv(readFileSync(filePath, 'utf8'))

  return rows.map((row, index) => {
    const lineNumber = index + 2 // +1 for the header row, +1 for 1-indexing
    const [name, position, teamCode, espn, yahoo] = row

    if (!VALID_POSITIONS.has(position as PositionCode)) {
      throw new Error(`${filePath}:${lineNumber}: unknown position "${position}" for player "${name}"`)
    }

    const espnValue = Number(espn)
    const yahooValue = Number(yahoo)
    if (!Number.isFinite(espnValue) || !Number.isFinite(yahooValue)) {
      throw new Error(`${filePath}:${lineNumber}: non-numeric auction value for player "${name}"`)
    }

    return { name, position: position as PositionCode, teamCode, espnValue, yahooValue }
  })
}
