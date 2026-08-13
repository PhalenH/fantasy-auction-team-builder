// Pastel -50 tints only — deliberately not saturated colors, so body text
// stays fully readable on top. Single source of truth shared by PlayerRow
// (full-row background) and RosterSlot (small badge background), so both
// panels use the exact same position-color vocabulary and can't drift
// apart from each other.

import type { PositionCode } from '../types/Player'

export const POSITION_TINTS: Record<PositionCode, string> = {
  QB: 'bg-red-50',
  // RB/WR bumped one step from -50 to -100: at -50 the two were nearly
  // indistinguishable from white/each other in the player list's alternating
  // rows (they're the two most common top-value positions, so they end up
  // doing most of the "striping" in practice) — one step is enough to read
  // clearly without becoming a bold color.
  //
  // RB uses a custom value rather than the stock green-100 (#dbfce7): once
  // the panel background moved from white to parchment (#f5f1e8), green-100
  // lost ~35% of its RGB-distance from the panel (blue-100 only lost ~17%),
  // because parchment already carries green-100's B channel almost exactly.
  // #d3fbe1 is a small nudge — not a full extra Tailwind step, which would
  // overshoot well past blue-100's contrast level — just enough to restore
  // rough visual parity between the two tints against parchment.
  RB: 'bg-[#d3fbe1]',
  WR: 'bg-blue-100',
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
