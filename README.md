# Fantasy Auction Draft Assistant

A web app for prepping and running a fantasy football auction draft. It combines ESPN and Yahoo auction values into one player pool, lets you configure your league's roster format and budget, and then run the live draft — selecting players, auto-assigning them to roster slots at a frozen price, tracking spend, and keeping a favorites shortlist — all in one place instead of spreadsheets and browser tabs.

The app is built to swap its data source without structural rework: the same `Player`/`Team`/`PlayerValuation` tables are populated either by a mock/seed script or by a real ESPN/Yahoo ingestion pipeline, and every layer above the database is written against that shared shape.

## Tech stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Vite
- **Backend:** Node.js, Express 5, TypeScript (`tsx` for dev/scripts, no build step for the server)
- **Database:** PostgreSQL 16 (via `docker-compose.yml`), accessed with the plain `pg` driver — **no ORM**
- **Testing:** Vitest (two projects — `web` on jsdom, `server` against a real local Postgres), Testing Library, Supertest

## Current status

The app runs end to end: React frontend → Express API (`GET /api/players`, `/api/league-formats`, `/api/teams`) → Postgres.

**Real ESPN/Yahoo ingestion (`server/ingestion/`) is the primary, live data path.** It upserts a weekly auction-value CSV plus a bye-week CSV into `Team`, `Player`, and `PlayerValuation`, matching existing players on `(name, position)` (see `docs/datamodel.md`). Re-running it against an updated CSV updates rows in place rather than duplicating them.

`server/seed/` (mock/seeded data, truncate-and-reinsert) still works as a no-CSV-required dev fallback, but it is **not** the maintained data path going forward — its mock player set isn't kept in sync with real values.

Both paths write to the same tables, so the frontend and API layer are identical regardless of which one populated the database.

## Core features

- **Player pool** with position filtering (including a FLEX filter derived from roster config) and sorting by combined auction value (ESPN + Yahoo averaged), most expensive first.
- **League setup**: choose a league format (Regular, Regular-3WR, Double Flex) and an auction budget; toggle Kicker/Defense roster slots on or off independently of format.
- **Auction draft flow**: select a player, and they're automatically assigned to an eligible open roster slot at their calculated combined value — no manual bid entry at assignment time, no interruption to the selection flow.
- **Frozen price snapshots**: a player's assigned price does not change retroactively if valuations are updated later (including by a subsequent ingestion run).
- **Editable post-assignment pricing**: a pencil icon on an occupied roster slot turns the price into a stepper (±$0.50, or type a value directly) — whole-dollar/$0.50 increments, $1 minimum, no maximum. Editing is just as frozen a snapshot as the original auto-assigned price.
- **Move/swap drafted players** between eligible roster slots after assignment.
- **Un-drafting**: click a drafted player's name to remove them from their slot, refund their price to the budget, and return them to the available pool.
- **Favorites**: independent of drafted status in both directions — favoriting never drafts a player, drafting never favorites one.
- **Saved rosters**: save a *complete* roster (every active slot filled, including bench and any enabled K/DST slots) to `localStorage`, up to 6 at a time; resume a save later to keep editing it. Favorites are not part of a save.
- **Budget tracking**: total, spent, and remaining budget, all live-recalculated. Overspending is allowed by design — remaining budget simply goes negative.

## Architecture overview

Per `docs/CLAUDE.md`'s Architecture Principles, the following stay separated both conceptually and in code:

- **Player data** (`services/playerService.ts`, `types/Player.ts`)
- **League configuration** (`data/leagueFormats.ts`, `types/League.ts`, `services/leagueService.ts`)
- **Roster state** (`hooks/useRoster.ts`, `utils/rosterAssignment.ts`)
- **Auction/budget calculations** (`utils/auctionCalculations.ts`, `utils/budgetCalculations.ts`)
- **Favorites** (`hooks/useFavorites.ts`)
- **UI components** (`components/`, `pages/`) — these consume the hooks/utils above rather than embedding business logic themselves.

**Session isolation.** Draft progress — drafted status, favorites, roster assignments, remaining budget — lives only in frontend React state (optionally mirrored to `sessionStorage`/`localStorage` for refresh/close survival). None of it is ever written back to the Express API or Postgres. The Express layer is stateless and read-only: it serves reference data only (players, league formats, teams) and holds no in-memory notion of "the current draft." This is what makes multiple tabs/users/devices isolated from each other automatically, with no session-scoping code required.

**Data-source swap design.** `server/seed/` (truncate-and-reinsert from `src/data/mockPlayers.ts`) and `server/ingestion/` (upsert from real CSVs) are independent, sibling code paths that both terminate at the same `Player`/`Team`/`PlayerValuation` tables. Everything above the database — services, API routes, frontend — is identical regardless of which one populated it.

## Project structure

```
src/
├── components/       # PlayerList, PlayerRow, PlayerFilters, FavoritesList, Roster,
│                      # RosterSlot, BudgetDisplay, LeagueSelector, SavedRosterCard,
│                      # SaveRosterDialog, SwapSlotDialog, ConfirmDialog, DataStatus, ...
├── pages/
│   ├── Setup/         # league format + budget + K/DST toggles
│   ├── Draft/          # player pool + roster + budget, the main draft screen
│   └── SavedRosters/   # save/resume/delete saved rosters
├── hooks/             # useDraftSession, useRoster, useFavorites, useSavedRosters,
│                      # useAsyncData, sessionPersistence, useElementHeight, useMediaQuery
├── data/              # leagueFormats.ts (roster config), mockPlayers.ts (seed source only —
│                      # not imported by the frontend at runtime)
├── types/             # Player.ts, League.ts, Roster.ts
├── services/          # playerService.ts, leagueService.ts — call the real API via apiClient.ts
└── utils/             # auctionCalculations, budgetCalculations, rosterAssignment,
                        # rosterCompleteness, savedRoster

server/
├── db/                # pool.ts (pg Pool from DATABASE_URL), migrate.ts (SQL migration runner)
├── migrations/        # 001_initial_schema.sql, 002_team_and_real_ingestion.sql,
│                      # 003_team_code_not_null.sql
├── routes/            # players, league-formats, teams (GET only)
├── services/          # query layer the routes call
├── seed/               # lookups.ts (Position/ValuationSource/Team), seed.ts — mock/dev fallback
├── ingestion/          # sources/ (auctionValues.ts, byeWeeks.ts), normalize.ts, run.ts,
│                      # data/ (CSV inputs — weekly drops gitignored, a small sample committed)
├── app.ts             # Express app wiring (no listen — testable over an ephemeral port)
└── index.ts           # binds the port
```

No component reads `data/` files directly — `playerService`/`leagueService` call the Express API, which is the only thing that reads Postgres.

## Getting started

Requires Node.js and Docker (for the Postgres container).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start Postgres
docker compose up -d

# 4. Run migrations
npm run db:migrate

# 5a. Seed with mock data (no external files needed)...
npm run db:seed

# 5b. ...or ingest real data instead (auction-value CSV path is required;
#     bye-week CSV defaults to server/ingestion/data/Bye_Weeks.csv)
node --env-file=.env --import tsx server/ingestion/run.ts <path-to-auction-values.csv> [path-to-bye-weeks.csv]

# 6. Run the backend and frontend (two terminals)
npm run dev:server   # Express API on API_PORT (default 3001)
npm run dev          # Vite dev server on 5173, proxies /api to the Express server
```

Other useful scripts (see `package.json`):

```bash
npm run test         # frontend tests (vitest, jsdom)
npm run test:server  # backend tests (vitest, node — needs Postgres running)
npm run test:all     # both
npm run lint         # oxlint
npm run build        # tsc -b && vite build
npm run db:reset      # db:migrate + db:seed
```

## Development notes / gotchas

- **Overspending is allowed, not blocked.** `validateAssignment` only checks slot eligibility/capacity, never budget. `getRemainingBudget` is deliberately unclamped and can go negative.
- **Prices are frozen snapshots.** A price set at assignment (or edited afterward) never changes retroactively — not even when a later ingestion run updates the underlying `PlayerValuation` rows for that player.
- **No combined-value column.** Combined auction value is always derived at read time from `PlayerValuation` rows, never stored.
- **Roster/format config is seeded data, not hardcoded.** `LeagueFormat`/`RosterPositionSlot` rows drive available slots per format; adding a format is a data change, not a code change.
- **Seeding vs. ingestion use different write strategies.** `server/seed/` truncates and reinserts (safe only because nothing session-specific lives in these tables). `server/ingestion/` upserts, matching `Player` on normalized `(name, position)` — there's no ESPN/Yahoo ID in the source and there never will be, so a name-formatting change between runs can in theory create a duplicate player row rather than updating the existing one.
- **No user accounts.** Saved rosters exist, but they live entirely in `localStorage` on one browser/device — there's no server-side `User` or cross-device sync yet.
- **No ORM.** Migrations are hand-written SQL files run by a small custom runner; queries use `pg` directly.
- **The Express API is read-only and stateless by design.** There are no POST/PUT/DELETE routes, and no in-memory draft state — every response is a pure function of current database contents.

## Where to look next

- [`docs/CLAUDE.md`](docs/CLAUDE.md) — development rules, architecture principles, and the full project spec.
- [`docs/datamodel.md`](docs/datamodel.md) — full entity/relationship design (`Position`, `Team`, `ValuationSource`, `LeagueFormat`, `RosterPositionSlot`, `Player`, `PlayerValuation`), including the real-ingestion match-key design and open questions.
- `docs/manual_bid_entry_plan.md`, `docs/saved_rosters_plan.md`, `docs/ingestion_plan_final.md`, `docs/downstream_implementation_plan.md` — design history for specific features referenced above.
