# Downstream Implementation Plan — Team Lookup Table + Real Ingestion

Scope: every file/area outside `docs/datamodel.md` that needs to change as a result of the update you're applying now (new `Team` entity, `Player.team_code` replacing `nfl_team`/`bye_week`, real ingestion replacing the ID-based swap-in path). Ordered so each step's prerequisites are already in place by the time you get to it. Written to be usable directly as a Claude Code prompt/checklist.

## 1. Confirmed: how the mock/dev-fallback path satisfies the new `Player.team_code` FK

`Team` is treated the same way `CLAUDE.md`'s Backend Structure section already treats `Position`/`ValuationSource` — a small static list added to `server/seed/lookups.ts`, since it's the same "exists only as data, nothing in `src/` to read it from" situation. The 32 NFL team codes/names are effectively permanent; `bye_week` values there can be placeholders (schedules aren't meaningful in a mock context) and get overwritten for real once real ingestion runs.

## 2. `CLAUDE.md` edits

Two spots reference the retired design and would go stale otherwise:

- **Development Strategy status blurb**: currently describes the app as running against seeded mock data through a real API/DB, with "real ESPN/Yahoo ingestion... not yet started." Update to reflect that real ingestion is now the primary data path (per `datamodel.md`'s "Real ingestion" section), with mock/`server/seed/` demoted to dev fallback.
- **Backend Structure notes**: the line about the seed script matching on `espn_player_id`/`yahoo_player_id` no longer describes the real path — real ingestion matches on `(name, position)` instead (see `datamodel.md`). Also add `server/ingestion/` to the folder tree shown there, alongside the existing `server/seed/`.

No other sections of `CLAUDE.md` reference team/bye-week structure directly, so nothing else needs to change there.

## 3. Migration `server/migrations/002_team_and_real_ingestion.sql`

Per `datamodel.md`'s "Migration note":
- Create `team` table (`code` PK or unique, `display_name`, `bye_week`).
- Add `player.team_code` (FK → `team.code`).
- Backfill/drop `player.nfl_team` and `player.bye_week`.
- Add uniqueness constraint on `player (name, position)`.
- The migration itself only needs to create the `team` table (schema, no data) — populating it is `server/seed/lookups.ts`'s job (mock path) or `server/ingestion/`'s job (real path), not the migration's.

## 4. `server/seed/lookups.ts`

Add the static `Team` list alongside the existing `Position`/`ValuationSource` rows — same shape/pattern as what's already there for the other two lookup tables.

## 5. `server/ingestion/` module (net-new)

Per the structure already specified in `datamodel.md`:
```
server/ingestion/
├── sources/
│   ├── auctionValues.ts   # parses the weekly CSV (Player, Position, Team, ESPN ADP, Yahoo ADP)
│   └── byeWeeks.ts        # parses the bye-week CSV (Team, Bye Week)
├── normalize.ts           # name normalization for the Player match key
└── run.ts                 # orchestrates: upsert Team → upsert Player → upsert PlayerValuation
```
Both sources are CSV, sharing a single CSV-parsing utility rather than needing a separate xlsx-parsing dependency for one low-frequency file — per `CLAUDE.md`'s "do not introduce unnecessary dependencies" rule. The bye-week source started as an `.xlsx` and was converted once to `Bye_Weeks.csv`; future season updates should be exported/converted to CSV the same way before dropping into `server/ingestion/data/`, rather than reintroducing an xlsx parser.

Order matters inside `run.ts`: `Team` upsert must complete before `Player` upsert, since `player.team_code` is an FK. `PlayerValuation` upsert depends on `Player` rows existing (needs `player_id`).

Per `CLAUDE.md`'s Development Rules ("write tests for important business logic"), the name-normalization function in particular is worth testing directly — it's the piece doing the most unforced work now that there's no ID to match on.

## 6. Source data file location & version control

**Format:** both source files are CSV — `NFL_Auction_Values_8-11.csv` and `Bye_Weeks.csv` (the latter converted once from the original `.xlsx`, dropping the title row, keeping the `Team, Bye Week` header + 32 data rows). One shared CSV-parsing utility covers both, avoiding a second dependency (`xlsx`/`exceljs`) for a file that only updates once a season — per `CLAUDE.md`'s "do not introduce unnecessary dependencies" rule.

**Location:** `server/ingestion/data/` — sibling to `sources/`, `normalize.ts`, `run.ts` from step 5. Keeps the whole ingestion concern (code and the data it reads) self-contained in one folder rather than split across the repo. `sources/auctionValues.ts` and `sources/byeWeeks.ts` read from here.

**Version control:** the `8-11` in `NFL_Auction_Values_8-11.csv` implies these are date-stamped, recurring drops (a new one lands roughly weekly), not a static fixture — so they shouldn't be committed to git indefinitely the way a normal source file would be:
- `.gitignore` the actual weekly drops (e.g. `server/ingestion/data/NFL_Auction_Values_*.csv`), so the repo doesn't accumulate a growing pile of dated snapshots.
- Keep **one small sample file** committed (e.g. `server/ingestion/data/sample/`) — a handful of rows covering each position and at least one team-name edge case — for `normalize.ts` tests and any local dev/testing that shouldn't depend on the latest real drop being present.
- Bye-week data changes far less often (once a season, roughly) — reasonable to commit the current season's file normally rather than gitignore it, revisiting only if the ESPN/Yahoo CSV cadence turns out to apply here too.

## 7. Frontend/service layer

Anywhere the old `nfl_team`/`bye_week` shape is read needs to follow `team_code` + a joined `Team` lookup instead:

- **`src/types/Player.ts`** — update the `Player` type: `nfl_team: string` → `team_code: string`, remove `bye_week` (or keep it as a derived/joined field depending on how the API response is shaped — see next bullet).
- **`server` API response shape** (routes/services, once they exist per the "Extension points for the next pass" note in `CLAUDE.md`) — **decided: server-side join.** The player endpoint returns `team_code` plus the joined `display_name`/`bye_week` already resolved, rather than `team_code` alone with the frontend doing its own lookup against a separate teams fetch.
  - Lower error surface: one query, enforced correct by the `Player.team_code → Team` FK — nothing for two independently-fetched lists to get out of sync on (a second network call landing late, a stale cache, a component rendering before both resolve).
  - Consistent with existing precedent: combined auction value is already computed server-side rather than left to the client, even though the client technically could do that math — same reasoning applies here.
  - Keeps the join out of frontend code entirely, consistent with `CLAUDE.md`'s rule that business logic doesn't belong in UI components — a client-side join would otherwise need its own small hook/service just to do what the DB already guarantees for free.
  - **`GET /api/teams`** is still worth adding as a separate, lightweight endpoint — not for joining, but for cases like a "filter by team" dropdown that need a bare team list independent of any player data.
- **Any component currently displaying bye week** (e.g. `PlayerCard`) — no visual/behavior change expected, just confirm it's reading from the new field path once the type changes land.

## 8. Suggested sequencing

1. `CLAUDE.md` edits (step 2) — quick, unblocks nothing else but keeps docs in sync as you go rather than after the fact.
2. Migration (step 3).
3. `server/seed/lookups.ts` (step 4) — depends on migration existing.
4. `server/ingestion/` (step 5), including placing source data per step 6 — depends on migration; can be built/tested independently of the frontend.
5. Frontend/service updates (step 7) — depends on migration + a decision on API response shape.

Steps 2–4 are backend-only and don't touch `src/`; step 5 is the only piece that touches the frontend, and it's decoupled enough to happen last without blocking anything upstream.