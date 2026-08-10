// Query layer for league configuration — the only place that touches the
// pool for formats/slots. Same contract rule as playerService.ts: the return
// type is the frontend's own LeagueFormatWithSlots, so a drift between this
// API and what src/services/leagueService.ts returns is a build failure.

import type { Pool } from 'pg'

import type { LeagueFormatKey, LeagueFormatWithSlots, RosterPositionSlot, ToggleKey } from '../../src/types/League'
import type { PositionCode } from '../../src/types/Player'

interface FormatRow {
  id: number
  key: LeagueFormatKey
  display_name: string
}

interface SlotRow {
  id: number
  league_format_id: number
  slot_label: string
  count: number
  sort_order: number
  toggle_key: ToggleKey | null
  eligible_positions: PositionCode[]
}

const FORMATS_SQL = `
  SELECT id, key, display_name
  FROM league_format
  ORDER BY id
`

// array_agg collapses the roster_slot_eligible_position join rows back into
// the eligiblePositions array the frontend type expects. The join table
// exists so a bad position code is rejected by a foreign key rather than
// inserted silently (see CLAUDE.md's Backend Structure notes) — this is the
// read-side cost of that integrity, and it's one query, not one per slot.
//
// LEFT JOIN + FILTER, not an inner join: a slot with no eligible positions
// should come back as [] rather than vanishing from the payload or
// producing [null].
//
// Ordering inside array_agg only makes the result deterministic. It does NOT
// reproduce the mock data's order (mock FLEX is [RB, WR, TE]; this returns
// [RB, TE, WR]) because the join table has no ordering column. That's safe:
// eligiblePositions is consumed solely via .includes() in
// utils/rosterAssignment.ts and is never rendered.
const SLOTS_SQL = `
  SELECT s.id,
         s.league_format_id,
         s.slot_label,
         s."count",
         s.sort_order,
         s.toggle_key,
         COALESCE(
           array_agg(ep.position_code ORDER BY ep.position_code)
             FILTER (WHERE ep.position_code IS NOT NULL),
           ARRAY[]::TEXT[]
         ) AS eligible_positions
  FROM roster_position_slot s
  LEFT JOIN roster_slot_eligible_position ep ON ep.roster_position_slot_id = s.id
  GROUP BY s.id
  ORDER BY s.league_format_id, s.sort_order
`

function toSlot(row: SlotRow): RosterPositionSlot {
  return {
    id: String(row.id),
    leagueFormatId: String(row.league_format_id),
    slotLabel: row.slot_label,
    count: row.count,
    eligiblePositions: row.eligible_positions,
    sortOrder: row.sort_order,
    // Null is meaningful here — it marks a slot as always active, as opposed
    // to the toggle-gated K/DST slots — so unlike the optional player ids it
    // is preserved rather than converted to undefined.
    toggleKey: row.toggle_key,
  }
}

/**
 * Every league format with its roster slots embedded — the same shape
 * src/services/leagueService.ts returns from mock data.
 */
export async function getLeagueFormats(db: Pool): Promise<LeagueFormatWithSlots[]> {
  const [formats, slots] = await Promise.all([db.query<FormatRow>(FORMATS_SQL), db.query<SlotRow>(SLOTS_SQL)])

  const slotsByFormatId = new Map<number, RosterPositionSlot[]>()
  for (const row of slots.rows) {
    const existing = slotsByFormatId.get(row.league_format_id)
    if (existing) {
      existing.push(toSlot(row))
    } else {
      slotsByFormatId.set(row.league_format_id, [toSlot(row)])
    }
  }

  return formats.rows.map((row) => ({
    id: String(row.id),
    key: row.key,
    displayName: row.display_name,
    slots: slotsByFormatId.get(row.id) ?? [],
  }))
}
