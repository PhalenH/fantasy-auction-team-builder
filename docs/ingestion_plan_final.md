# Real Ingestion Plan — Finalized Decisions

Answers to your questions, plus the resulting `datamodel.md` update.

## 1. Does team still display if match key is (name, position)?

Yes — the match key only controls how an incoming CSV row gets matched to an *existing* `Player` row during upsert. It has no effect on what's stored or shown. `Player.nfl_team` (soon `Player.team_code`, see below) is still a normal field on every player and still renders in the UI same as today.

Concretely: if a player's team changes between runs, the upsert finds the existing row via `(name, position)`, then **updates** `team_code` on that same row to the new value. The player keeps their one `Player.id` and their full `PlayerValuation` history — nothing duplicates, nothing resets. That "update in place on trade" behavior was the reason to exclude team from the key in the first place.

Confirmed: proceeding with `(name, position)` as the match key.

## 2. Team lookup table — confirmed, here's the shape

Mirrors the existing `Position` pattern.

**Team** (new)
- `code` (e.g. `ARI`, `LAR`, `LAC` — the 3-letter codes already used in the CSV)
- `display_name` (e.g. "Arizona Cardinals" — from the bye-week sheet)
- `bye_week` (int — from the bye-week sheet)

**Player** (changed)
- `nfl_team` (free text) → **`team_code`** (FK → `Team.code`)
- `bye_week` **removed** from `Player` — no longer copied onto every player row; read via the `Team` join instead (`player.team_code → Team.bye_week`)

Why this is better than the free-field version from the last draft: a bye-week correction (schedule flex, etc.) is one `Team` row update instead of an update sweeping every player on that team, and a typo'd team code gets rejected by the FK instead of silently inserted — same referential-integrity reasoning the project already applied to `Position`.

**Ingestion touches `Team` too now:** each run's bye-week sheet upserts into `Team` (keyed on `code`) before player rows are processed, so the player-side join always has a current `bye_week` to read.

## 3. Mock data path — keep as dev fallback

`src/data/mockPlayers.ts` and `server/seed/seed.ts` stay in place, unchanged in behavior, as a no-CSV-required local dev path. It's a small static file — not worth deleting for storage reasons — but it's now explicitly a fallback, not the primary data path, and there's no obligation to keep it in sync with real player names/values going forward. If it ever gets stale enough to be more confusing than useful, regenerating a small fresh mock set later is cheap — no need to maintain this one indefinitely.

## 4. Updated match-key / upsert logic (finalized)

- **`Team`**: upsert on `code`.
- **`Player`**: upsert on `(name, position)` — normalize name (trim, case-fold, strip stray punctuation) before comparing, per the false-non-match risk flagged last round. `team_code` is overwritten to the incoming value every run (trade handling).
- **`PlayerValuation`**: upsert on `(player_id, source, season_year)`, same as originally planned — `auction_value`/`updated_at` overwritten each run.
- `espn_player_id` / `yahoo_player_id` stay on `Player`, nullable, permanently unpopulated under this pipeline — kept only in case a different ID-bearing source is ever added later, not actively used.

## 5. Ingestion module (finalized structure)

```
server/
├── ingestion/
│   ├── sources/
│   │   ├── auctionValues.ts   # reads/parses the weekly CSV
│   │   └── byeWeeks.ts        # reads/parses the bye-week xlsx
│   ├── normalize.ts           # name normalization used by the Player match
│   └── run.ts                 # orchestrates: upsert Team → upsert Player → upsert PlayerValuation
```

Kept as a sibling to `server/seed/`, not merged into it — `seed/` remains the truncate-and-reinsert mock path (Session Isolation still applies: neither path ever touches draft/roster/favorites state), `ingestion/` is the upsert-based real path. They share no code beyond both ultimately writing to the same `Player`/`PlayerValuation` tables, which is exactly the "data-source swap, not a structural one" property the project has been designing toward.

## 6. Still open (not blocking, flagged for later)

- **Stale/dropped players**: a player absent from a future CSV just goes unrefreshed (no "inactive" flag exists yet). Unchanged from last round's note — still an open call, not resolved here.
- **Migration for the `Team` table + `Player.team_code`/dropped `bye_week` column**: this is a real schema change (unlike the earlier mock-data refresh), so it needs its own migration file (`002_...sql`) once you're ready to implement — flagging now so it's not mistaken for a data-only change.

## 7. Suggested next step

With all three decisions confirmed, the remaining work is implementation, not more planning:
1. Migration: add `Team`, alter `Player` (`nfl_team`→`team_code` FK, drop `bye_week`).
2. Update `docs/datamodel.md` itself with the `Team` entity and the revised `Player`/match-key sections above (this doc is the source content for that edit).
3. Build `server/ingestion/` per section 5.
4. Run it once against the current CSV/xlsx pair and spot-check row counts (32 teams, 448 players, 896 valuations).

Let me know if you want me to go ahead and write out the full replacement `datamodel.md` text now, or hold until you're ready to move into implementation.
