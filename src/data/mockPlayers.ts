// Seeded mock player data, per CLAUDE.md's Development Strategy — stands in
// for the Player/PlayerValuation tables in docs/datamodel.md until real
// ESPN/Yahoo ingestion replaces it. Combined auction value is intentionally
// NOT precomputed here; it's derived from playerValuations at read time by
// utils/auctionCalculations.ts (not built yet).

import type { Player, PlayerValuation } from '../types/Player'

export const players: Player[] = [
  { id: 'p1', name: 'Patrick Mahomes', teamCode: 'KC', teamDisplayName: 'Kansas City Chiefs', position: 'QB', byeWeek: 10 },
  { id: 'p2', name: 'Josh Allen', teamCode: 'BUF', teamDisplayName: 'Buffalo Bills', position: 'QB', byeWeek: 12 },
  { id: 'p3', name: 'Christian McCaffrey', teamCode: 'SF', teamDisplayName: 'San Francisco 49ers', position: 'RB', byeWeek: 9 },
  { id: 'p4', name: 'Bijan Robinson', teamCode: 'ATL', teamDisplayName: 'Atlanta Falcons', position: 'RB', byeWeek: 11 },
  { id: 'p5', name: 'Justin Jefferson', teamCode: 'MIN', teamDisplayName: 'Minnesota Vikings', position: 'WR', byeWeek: 6 },
  { id: 'p6', name: "Ja'Marr Chase", teamCode: 'CIN', teamDisplayName: 'Cincinnati Bengals', position: 'WR', byeWeek: 12 },
  { id: 'p7', name: 'Amon-Ra St. Brown', teamCode: 'DET', teamDisplayName: 'Detroit Lions', position: 'WR', byeWeek: 5 },
  { id: 'p8', name: 'Travis Kelce', teamCode: 'KC', teamDisplayName: 'Kansas City Chiefs', position: 'TE', byeWeek: 10 },
  { id: 'p9', name: 'Harrison Butker', teamCode: 'KC', teamDisplayName: 'Kansas City Chiefs', position: 'K', byeWeek: 10 },
  { id: 'p10', name: 'San Francisco 49ers', teamCode: 'SF', teamDisplayName: 'San Francisco 49ers', position: 'DST', byeWeek: 9 },
  // p11-p20: extra RBs so RB-eligible capacity (RB slots + FLEX + BENCH,
  // 10 total in the Regular format) can actually be exhausted by clicking
  // through the running app, not just simulated at the PlayerList level.
  { id: 'p11', name: 'Saquon Barkley', teamCode: 'PHI', teamDisplayName: 'Philadelphia Eagles', position: 'RB', byeWeek: 5 },
  { id: 'p12', name: 'Breece Hall', teamCode: 'NYJ', teamDisplayName: 'NY Jets', position: 'RB', byeWeek: 12 },
  { id: 'p13', name: 'Jonathan Taylor', teamCode: 'IND', teamDisplayName: 'Indianapolis Colts', position: 'RB', byeWeek: 11 },
  { id: 'p14', name: 'Derrick Henry', teamCode: 'BAL', teamDisplayName: 'Baltimore Ravens', position: 'RB', byeWeek: 7 },
  { id: 'p15', name: 'Kyren Williams', teamCode: 'LAR', teamDisplayName: 'LA Rams', position: 'RB', byeWeek: 8 },
  { id: 'p16', name: "De'Von Achane", teamCode: 'MIA', teamDisplayName: 'Miami Dolphins', position: 'RB', byeWeek: 6 },
  { id: 'p17', name: 'Jahmyr Gibbs', teamCode: 'DET', teamDisplayName: 'Detroit Lions', position: 'RB', byeWeek: 5 },
  { id: 'p18', name: 'Isiah Pacheco', teamCode: 'KC', teamDisplayName: 'Kansas City Chiefs', position: 'RB', byeWeek: 10 },
  { id: 'p19', name: 'James Cook', teamCode: 'BUF', teamDisplayName: 'Buffalo Bills', position: 'RB', byeWeek: 12 },
  { id: 'p20', name: 'Rachaad White', teamCode: 'TB', teamDisplayName: 'Tampa Bay Buccaneers', position: 'RB', byeWeek: 11 },
]

export const playerValuations: PlayerValuation[] = [
  { id: 'v1', playerId: 'p1', source: 'espn', auctionValue: 42, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v2', playerId: 'p1', source: 'yahoo', auctionValue: 45, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v3', playerId: 'p2', source: 'espn', auctionValue: 40, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v4', playerId: 'p2', source: 'yahoo', auctionValue: 41, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v5', playerId: 'p3', source: 'espn', auctionValue: 58, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v6', playerId: 'p3', source: 'yahoo', auctionValue: 55, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v7', playerId: 'p4', source: 'espn', auctionValue: 52, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v8', playerId: 'p4', source: 'yahoo', auctionValue: 54, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v9', playerId: 'p5', source: 'espn', auctionValue: 50, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v10', playerId: 'p5', source: 'yahoo', auctionValue: 48, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v11', playerId: 'p6', source: 'espn', auctionValue: 47, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v12', playerId: 'p6', source: 'yahoo', auctionValue: 46, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v13', playerId: 'p7', source: 'espn', auctionValue: 38, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v14', playerId: 'p7', source: 'yahoo', auctionValue: 40, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v15', playerId: 'p8', source: 'espn', auctionValue: 28, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v16', playerId: 'p8', source: 'yahoo', auctionValue: 26, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v17', playerId: 'p9', source: 'espn', auctionValue: 2, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v18', playerId: 'p9', source: 'yahoo', auctionValue: 1, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v19', playerId: 'p10', source: 'espn', auctionValue: 3, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v20', playerId: 'p10', source: 'yahoo', auctionValue: 2, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v21', playerId: 'p11', source: 'espn', auctionValue: 41, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v22', playerId: 'p11', source: 'yahoo', auctionValue: 43, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v23', playerId: 'p12', source: 'espn', auctionValue: 33, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v24', playerId: 'p12', source: 'yahoo', auctionValue: 31, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v25', playerId: 'p13', source: 'espn', auctionValue: 37, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v26', playerId: 'p13', source: 'yahoo', auctionValue: 39, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v27', playerId: 'p14', source: 'espn', auctionValue: 30, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v28', playerId: 'p14', source: 'yahoo', auctionValue: 28, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v29', playerId: 'p15', source: 'espn', auctionValue: 26, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v30', playerId: 'p15', source: 'yahoo', auctionValue: 24, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v31', playerId: 'p16', source: 'espn', auctionValue: 25, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v32', playerId: 'p16', source: 'yahoo', auctionValue: 27, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v33', playerId: 'p17', source: 'espn', auctionValue: 22, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v34', playerId: 'p17', source: 'yahoo', auctionValue: 20, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v35', playerId: 'p18', source: 'espn', auctionValue: 14, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v36', playerId: 'p18', source: 'yahoo', auctionValue: 12, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v37', playerId: 'p19', source: 'espn', auctionValue: 18, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v38', playerId: 'p19', source: 'yahoo', auctionValue: 16, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },

  { id: 'v39', playerId: 'p20', source: 'espn', auctionValue: 15, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  { id: 'v40', playerId: 'p20', source: 'yahoo', auctionValue: 13, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
]
