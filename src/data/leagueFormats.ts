// Seeded league format / roster slot config, mirroring docs/datamodel.md's
// LeagueFormat + RosterPositionSlot shape. This is data, not code — adding
// or changing a format means editing the arrays below, never the
// components/hooks/utils that consume them (see CLAUDE.md's Frontend
// Structure notes on data/leagueFormats.ts).

import type { LeagueFormat, RosterPositionSlot } from '../types/League'

export const leagueFormats: LeagueFormat[] = [
  { id: 'regular', key: 'regular', displayName: 'Regular' },
  { id: 'regular_3wr', key: 'regular_3wr', displayName: 'Regular - 3WR' },
  { id: 'double_flex', key: 'double_flex', displayName: 'Double Flex' },
]

const FLEX_ELIGIBLE = ['RB', 'WR', 'TE'] as const

export const rosterPositionSlots: RosterPositionSlot[] = [
  // Regular: QB1 / RB2 / WR2 / TE1 / FLEX1 / BENCH7 (+ K/DST toggled)
  { id: 'regular-qb', leagueFormatId: 'regular', slotLabel: 'QB', count: 1, eligiblePositions: ['QB'], sortOrder: 1, toggleKey: null },
  { id: 'regular-rb', leagueFormatId: 'regular', slotLabel: 'RB', count: 2, eligiblePositions: ['RB'], sortOrder: 2, toggleKey: null },
  { id: 'regular-wr', leagueFormatId: 'regular', slotLabel: 'WR', count: 2, eligiblePositions: ['WR'], sortOrder: 3, toggleKey: null },
  { id: 'regular-te', leagueFormatId: 'regular', slotLabel: 'TE', count: 1, eligiblePositions: ['TE'], sortOrder: 4, toggleKey: null },
  { id: 'regular-flex', leagueFormatId: 'regular', slotLabel: 'FLEX', count: 1, eligiblePositions: [...FLEX_ELIGIBLE], sortOrder: 5, toggleKey: null },
  { id: 'regular-k', leagueFormatId: 'regular', slotLabel: 'K', count: 1, eligiblePositions: ['K'], sortOrder: 6, toggleKey: 'kicker' },
  { id: 'regular-dst', leagueFormatId: 'regular', slotLabel: 'DST', count: 1, eligiblePositions: ['DST'], sortOrder: 7, toggleKey: 'defense' },
  { id: 'regular-bench', leagueFormatId: 'regular', slotLabel: 'BENCH', count: 7, eligiblePositions: ['QB', 'RB', 'WR', 'TE', 'K', 'DST'], sortOrder: 8, toggleKey: null },

  // Regular-3WR: QB1 / RB2 / WR3 / TE1 / FLEX1 / BENCH7 (+ K/DST toggled)
  { id: 'regular_3wr-qb', leagueFormatId: 'regular_3wr', slotLabel: 'QB', count: 1, eligiblePositions: ['QB'], sortOrder: 1, toggleKey: null },
  { id: 'regular_3wr-rb', leagueFormatId: 'regular_3wr', slotLabel: 'RB', count: 2, eligiblePositions: ['RB'], sortOrder: 2, toggleKey: null },
  { id: 'regular_3wr-wr', leagueFormatId: 'regular_3wr', slotLabel: 'WR', count: 3, eligiblePositions: ['WR'], sortOrder: 3, toggleKey: null },
  { id: 'regular_3wr-te', leagueFormatId: 'regular_3wr', slotLabel: 'TE', count: 1, eligiblePositions: ['TE'], sortOrder: 4, toggleKey: null },
  { id: 'regular_3wr-flex', leagueFormatId: 'regular_3wr', slotLabel: 'FLEX', count: 1, eligiblePositions: [...FLEX_ELIGIBLE], sortOrder: 5, toggleKey: null },
  { id: 'regular_3wr-k', leagueFormatId: 'regular_3wr', slotLabel: 'K', count: 1, eligiblePositions: ['K'], sortOrder: 6, toggleKey: 'kicker' },
  { id: 'regular_3wr-dst', leagueFormatId: 'regular_3wr', slotLabel: 'DST', count: 1, eligiblePositions: ['DST'], sortOrder: 7, toggleKey: 'defense' },
  { id: 'regular_3wr-bench', leagueFormatId: 'regular_3wr', slotLabel: 'BENCH', count: 7, eligiblePositions: ['QB', 'RB', 'WR', 'TE', 'K', 'DST'], sortOrder: 8, toggleKey: null },

  // Double Flex: QB1 / RB2 / WR2 / TE1 / FLEX2 / BENCH7 (+ K/DST toggled)
  { id: 'double_flex-qb', leagueFormatId: 'double_flex', slotLabel: 'QB', count: 1, eligiblePositions: ['QB'], sortOrder: 1, toggleKey: null },
  { id: 'double_flex-rb', leagueFormatId: 'double_flex', slotLabel: 'RB', count: 2, eligiblePositions: ['RB'], sortOrder: 2, toggleKey: null },
  { id: 'double_flex-wr', leagueFormatId: 'double_flex', slotLabel: 'WR', count: 2, eligiblePositions: ['WR'], sortOrder: 3, toggleKey: null },
  { id: 'double_flex-te', leagueFormatId: 'double_flex', slotLabel: 'TE', count: 1, eligiblePositions: ['TE'], sortOrder: 4, toggleKey: null },
  { id: 'double_flex-flex', leagueFormatId: 'double_flex', slotLabel: 'FLEX', count: 2, eligiblePositions: [...FLEX_ELIGIBLE], sortOrder: 5, toggleKey: null },
  { id: 'double_flex-k', leagueFormatId: 'double_flex', slotLabel: 'K', count: 1, eligiblePositions: ['K'], sortOrder: 6, toggleKey: 'kicker' },
  { id: 'double_flex-dst', leagueFormatId: 'double_flex', slotLabel: 'DST', count: 1, eligiblePositions: ['DST'], sortOrder: 7, toggleKey: 'defense' },
  { id: 'double_flex-bench', leagueFormatId: 'double_flex', slotLabel: 'BENCH', count: 7, eligiblePositions: ['QB', 'RB', 'WR', 'TE', 'K', 'DST'], sortOrder: 8, toggleKey: null },
]
