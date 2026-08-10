// Pastel -50 tints only — deliberately not saturated colors, so body text
// stays fully readable on top. Single source of truth shared by PlayerRow
// (full-row background) and RosterSlot (small badge background), so both
// panels use the exact same position-color vocabulary and can't drift
// apart from each other.

import type { PositionCode } from '../types/Player'

export const POSITION_TINTS: Record<PositionCode, string> = {
  QB: 'bg-red-50',
  RB: 'bg-green-50',
  WR: 'bg-blue-50',
  TE: 'bg-yellow-50',
  DST: 'bg-purple-50',
  K: 'bg-pink-50',
}

// Roster slot labels include FLEX and BENCH, which aren't Player positions
// (no single position maps to "FLEX"), so this is a superset keyed by slot
// label string rather than PositionCode. FLEX gets its own distinct color
// since it doesn't belong to any one position; BENCH stays neutral gray.
export const SLOT_BADGE_TINTS: Record<string, string> = {
  ...POSITION_TINTS,
  FLEX: 'bg-rose-100',
  BENCH: 'bg-slate-100',
}
