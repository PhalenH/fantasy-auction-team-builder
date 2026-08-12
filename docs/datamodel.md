# Data Model — Fantasy Auction Draft Assistant

Entity/relationship design only — no SQL or application code. This revision reflects the pivot to real ESPN/Yahoo auction-value ingestion (weekly CSV + bye-week spreadsheet), which replaces the mock data as the primary source. The Postgres implementation lives at `server/migrations/001_initial_schema.sql` (mock-era schema) plus `server/migrations/002_team_and_real_ingestion.sql` (this round's changes — see "Migration note" below); this doc stays the conceptual reference, `server/seed/seed.ts` remains the mock-data fallback path, and `server/ingestion/` is the new real-data path. See `ingestion_plan_final.md` for the decision history behind this round's changes.

## Entities

### Reference / configuration data (server-authoritative, shared by all users)

**Position** — lookup table, not a hardcoded enum
- `code` (QB, RB, WR, TE, K, DST)
- `display_name`

Both `Player.position` and roster-slot eligibility reference this same table, so there's one vocabulary instead of two enums that can drift out of sync.

**Team** — lookup table (**new this round**)
- `code` (3-letter, e.g. `ARI`, `LAR`, `LAC` — matches the codes used by the auction-value source)
- `display_name` (full name, e.g. "Arizona Cardinals" — from the bye-week source)
- `bye_week` (int — from the bye-week source)

Added for the same referential-integrity reason `Position` is a lookup table rather than a free string: a typo'd team code is now rejected by a foreign key instead of silently inserted, and a bye-week schedule correction is one row update instead of a sweep across every player on that team. Upserted on `code` each ingestion run, ahead of `Player`/`PlayerValuation`, so the player-side join always has a current `bye_week` to read.

**ValuationSource** — lookup table for auction-value providers
- `code` (espn, yahoo, later nfl, custom_projection, etc.)
- `display_name`

**LeagueFormat**
- `id`
- `key`
- `display_name`

Seeds **three** rows (finalized): `regular`, `regular_3wr`, `double_flex`.

`super_flex` was considered during design (two dedicated QB slots, not the conventional "superflex" meaning of a single flex slot that also accepts QB) but has since been removed as an option — not part of MVP scope.

**RosterPositionSlot** — the roster template for a given format
- `id`
- `league_format_id` (FK → LeagueFormat)
- `slot_label` (e.g. QB, FLEX, K, DST, BENCH)
- `count` (how many of this slot type exist, e.g. RB: 2)
- `eligible_positions` (set of Position codes that can fill this slot — e.g. FLEX → {RB, WR, TE}). Implemented as a `roster_slot_eligible_position` join table rather than an array column, so a typo'd position code is rejected by a foreign key instead of inserting silently — the same referential-integrity reasoning behind making `Position` (and now `Team`) a lookup table.
- `sort_order`
- `toggle_key` (nullable) — `'kicker'` on the K slot, `'defense'` on the DST slot, `null` on every other slot (always included). See "Kicker/Defense toggles" below.

### Player data

**Player**
- `id`
- `name`
- `team_code` (FK → `Team.code`, **NOT NULL**) — **replaces** the old free-text `nfl_team` field
- `position` (FK → Position)
- `espn_player_id` (nullable) / `yahoo_player_id` (nullable) — reserved fields, kept in the schema in case a future, different data source provides real IDs. Under the current CSV-based ingestion pipeline specifically, **these remain permanently null** — the source has no such IDs and, per project decision, never will. Matching for this pipeline uses `(name, position)` instead (see "Real ingestion" below).

`bye_week` is **removed** from `Player` (was a copied field in the mock-era schema). It's now read via `Player.team_code → Team.bye_week` — one join instead of a value duplicated onto every player row, and a schedule correction touches one `Team` row instead of every player on that team.

Positions in scope for MVP: **QB, RB, WR, TE, K, DST** (K/DST confirmed in-scope, but their roster slots are toggle-gated — see below).

**PlayerValuation** — one row per (player, source, season)
- `id`
- `player_id` (FK → Player)
- `source` (FK → ValuationSource)
- `auction_value`
- `season_year`
- `updated_at`

Combined/calculated value is **not** a stored column — it's derived by a service that computes the mean of a player's `PlayerValuation` rows on read (or a cached/materialized value later, without changing the underlying shape). Unchanged from the mock-era design.

`season_year` defaults to `2026` for the current ingestion source (per the "2026-2027" label on the bye-week schedule). Still no history/versioning table — each ingestion run upserts the current value per `(player_id, source, season_year)`, overwriting `auction_value`/`updated_at` in place. A historical-snapshot table remains a straightforward additive change if wanted later.

### Frontend-only / session state (never persisted server-side)

**DraftSession** (conceptual — lives in React state, not the database)
- `league_format_id`
- `budget`
- `defense_enabled: boolean` — set at league-setup time, same tier/lifecycle as the budget input
- `kicker_enabled: boolean` — same as above

**RosterAssignment** (frontend list): `{ slot_instance_id, player_id, price_paid }` — determines "drafted" status by membership. `price_paid` is set automatically to the player's calculated combined auction value at the moment of assignment (a frozen snapshot) — there is no manual bid-entry UI in MVP, and the value never changes retroactively if the underlying `PlayerValuation` rows are updated later (including by a subsequent ingestion run).

**Favorites**: a frontend id-set — determines "favorited" status by membership.

Neither `RosterAssignment` nor favorites ever get written back to `Player`, `Team`, or any shared table — see the Session Isolation rule in `CLAUDE.md`.

## Relationships

- `LeagueFormat` 1──* `RosterPositionSlot` *──* `Position` (via `eligible_positions`)
- `Player` *──1 `Position`
- `Player` *──1 `Team` (**new**)
- `Player` 1──* `PlayerValuation` *──1 `ValuationSource`
- Nothing here references a `User` — there isn't one yet.

## Roster composition (seeded data, not code)

Unchanged from the prior round — this round only touches player/team/valuation data, not roster/format config.

All three formats share the same six base slot types (QB/RB/WR/TE/FLEX/BENCH) plus the two toggle-gated slots (K/DST). Only the row values differ per format — adding or changing a format is a data edit, never a code change.

| Format | Slots |
|---|---|
| Regular | QB1 / RB2 / WR2 / TE1 / FLEX1 (RB/WR/TE) / BENCH7 |
| Regular-3WR | QB1 / RB2 / WR3 / TE1 / FLEX1 (RB/WR/TE) / BENCH7 |
| Double Flex | QB1 / RB2 / WR2 / TE1 / FLEX2 (RB/WR/TE) / BENCH7 |

Every format also gets one K slot (`toggle_key='kicker'`) and one DST slot (`toggle_key='defense'`). Seeded volume: 6 positions, 2 sources, 3 formats, 24 roster-position-slot rows (8 per format), 45 eligible-position rows (15 per format: QB/RB/WR/TE/K/DST contribute 1 each, FLEX 3, BENCH 6).

## Kicker/Defense toggles

Unchanged. K and DST are not properties of a format (any of the three formats can run with K/DST on or off independently):

1. `RosterPositionSlot.toggle_key` tags the K and DST slots (`'kicker'` / `'defense'`); every other slot is `null` (always active).
2. `DraftSession` (frontend state) carries `defense_enabled` / `kicker_enabled`, set at league-setup time — not persisted server-side.
3. A slot is part of the active roster for a session if `toggle_key` is `null`, or if the session's corresponding toggle is on. Assignment/validation logic reads this generically — no format- or position-specific branching in code.
4. Hiding K/DST players from the pool when their toggle is off is a UI-layer filter on the existing `Position` field — no model change needed.

## Bench slots

Unchanged. `RosterPositionSlot(slot_label='BENCH', count=7, eligible_positions=ALL)`. Position-agnostic and, like every slot, `count` is a capacity ceiling, not a fill requirement.

## Budget presets

Unchanged. Treated as a UI-layer concern (constants), not modeled data.

## Lookup tables vs. enums

`Position`, `Team`, and `ValuationSource` are small reference tables rather than hardcoded enums or free strings, for referential integrity and easy extension. `Team` joins this group as of this round, for the same reasons the other two were chosen as lookup tables originally.

## Real ingestion (replaces the old ID-based "swap-in path")

The original design assumed real ESPN/Yahoo ingestion would match incoming rows to existing `Player` rows via `espn_player_id`/`yahoo_player_id`. The actual data source (a recurring, date-stamped CSV of auction values + a bye-week spreadsheet) has no such IDs and, per project decision, never will — so that matching mechanism doesn't apply and is replaced by the following.

**Source shape:**
- Auction-value CSV: `Player, Position, Team, ESPN ADP, Yahoo ADP` (despite the column header, these are dollar auction values, not draft-position ADP — confirmed) — one row per player.
- Bye-week spreadsheet: `Team` (full name), `Bye Week` (int) — one row per NFL team.

**Match keys (upsert, not truncate-and-reinsert):**
- `Team`: upsert on `code`.
- `Player`: upsert on `(name, position)`, with name normalized (trim, case-fold, strip stray punctuation) before comparing, since there's no ID to fall back on. `team_code` is overwritten to the incoming value on every run — this is what makes a trade update the existing player in place (same `id`, full `PlayerValuation` history intact) rather than creating a duplicate row.
- `PlayerValuation`: upsert on `(player_id, source, season_year)`, `auction_value`/`updated_at` overwritten each run — unchanged from the original design.

**Known limitation:** matching on `(name, position)` without an ID means inconsistent name formatting between runs (a suffix added/dropped, punctuation, hyphenation changes) can cause a false non-match, creating a duplicate `Player` instead of updating the existing one. This is a structural limitation of an ID-less source, not a bug — normalization reduces but doesn't eliminate it. Not resolved further at this time.

**Module location:** `server/ingestion/` (sibling to `server/seed/`, not merged into it):
```
server/
├── ingestion/
│   ├── sources/
│   │   ├── auctionValues.ts   # reads/parses the weekly CSV
│   │   └── byeWeeks.ts        # reads/parses the bye-week spreadsheet
│   ├── normalize.ts           # name normalization used by the Player match
│   └── run.ts                 # orchestrates: upsert Team → upsert Player → upsert PlayerValuation
```
`server/seed/` (mock data, truncate-and-reinsert) remains as a dev fallback requiring no external files — no longer the primary data path, and not expected to be kept in sync with real player values going forward. Both paths write to the same `Player`/`Team`/`PlayerValuation` tables, preserving the "data-source swap, not a structural one" property the project has designed toward from the start.

## Budget enforcement

Unchanged. Overspending is **allowed, not blocked**. `validateAssignment` (utils/rosterAssignment.ts) only checks slot eligibility/capacity — it does not compare price against remaining budget. `getRemainingBudget` (utils/budgetCalculations.ts) is deliberately unclamped, so remaining budget can go negative if calculated values exceed the total.

## Primary key strategy

DB-generated identity ints, with real uniqueness enforced on the natural/business keys: `team.code` (**new**), `league_format.key`, `(league_format_id, slot_label)`, `(player_id, source, season_year)`, `(player.name, player.position)` (**new** — the real-ingestion match key, replacing the retired `espn_player_id`/`yahoo_player_id` uniqueness constraints from the mock-era design). `espn_player_id`/`yahoo_player_id` remain nullable, unique-when-present columns on `Player` for possible future use, but are not the active match key under this pipeline. `player.team_code`, by contrast, is a required (**NOT NULL**) FK, not just nullable-when-present — every player row has a team.

## Migration note

This round's schema change (`server/migrations/002_team_and_real_ingestion.sql`, not yet written) needs to: create `Team`; add `Player.team_code` (FK → `Team.code`); drop `Player.nfl_team` and `Player.bye_week`; add the `(name, position)` uniqueness constraint on `Player`. This is a real schema migration, not a data-only refresh — flagged so it isn't mistaken for the latter when implementation starts.

## Resolved this round

- Auction-value source columns ("ESPN ADP"/"Yahoo ADP") confirmed to be real dollar auction values, not draft-position ADP.
- `season_year` defaults to `2026` for the current source.
- This is the start of real (recurring) ingestion, not a one-time mock-data refresh.
- Match-key strategy for real ingestion finalized as `(name, position)` for `Player`, since the source has and will have no ESPN/Yahoo IDs.
- `Team` promoted from a free-text field on `Player` to its own lookup table, carrying `bye_week`; `Player.bye_week` removed.
- Mock data (`src/data/mockPlayers.ts`, `server/seed/seed.ts`) retained as a dev fallback, explicitly no longer the primary/maintained data path.

## Still open

- **Stale/dropped players**: no "inactive" concept exists yet. A player absent from a future ingestion run currently just goes unrefreshed rather than being flagged or hidden. Options (add an `active: boolean` to `Player` and filter, vs. leave as-is) not yet decided.
- Migration file for this round's schema change (see "Migration note" above) not yet written.