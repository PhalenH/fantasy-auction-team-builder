# CLAUDE.md — Fantasy Auction Draft Assistant

This file defines the requirements, architecture, and development rules for this project. Follow it when generating or modifying code.

## Project Goal

Build a web application that helps fantasy football users manage an auction draft by comparing player auction values, selecting players, assigning them to roster positions, tracking auction spending, and maintaining a list of favorite players.

## Tech Stack

**Frontend:** React, TypeScript, Tailwind CSS

**Backend:** Node.js, Express, TypeScript

**Database:** PostgreSQL

**Development tools:** VS Code, Claude Code, GitHub

## Development Strategy

Build the application using mock/seeded player data first. Do **not** implement ESPN or Yahoo data ingestion until core application functionality (player display, league setup, draft interface, budget tracking, favorites) is working end to end.

The data model should be designed so real ESPN/Yahoo data can replace the mock data later without structural rework.

**Status: milestone reached.** The app now runs end to end against the real stack — React frontend → Express API → Postgres, seeded from the same mock data. This is not the same thing as real ESPN/Yahoo ingestion: the content in the database is still the seeded mock player set, just served through a real API and database instead of bundled directly into the frontend. Real ESPN/Yahoo ingestion (writing into `player_valuation` via the match keys on `Player`, per `docs/datamodel.md`'s swap-in path) remains the next phase, not yet started.

## Core User Flow (MVP)

```
Open App
   ↓
Choose League Format
   ↓
Choose Auction Budget
   ↓
View Player Pool
   ↓
Select Player
   ↓
Assign Player to Roster Position
   ↓
Player's Auction Value Added to Team Total
   ↓
Remaining Budget Updated
   ↓
Favorite / Unfavorite Players
   ↓
View Favorites in Separate List
```

## Core Features

1. Player database
2. ESPN auction average
3. Yahoo auction average
4. Combined/calculated player auction value
5. League format selection
6. Auction budget selection
7. Roster management
8. Player selection
9. Position assignment
10. Remaining budget calculation
11. Favorite players
12. Favorites view

## Player Data Model

Each player record should contain:

- Name
- NFL team
- Position
- Bye week
- ESPN auction average
- Yahoo auction average
- Calculated average auction value (ESPN + Yahoo averaged)

Example:

```
Name: Patrick Mahomes
Team: KC
Position: QB
ESPN Average: $42
Yahoo Average: $45
Combined Average: $43.50
```

The player list should support filtering by position, and should eventually support search. It defaults to sorting by combined auction value in descending order (most expensive player first).

## League Setup

Before entering the draft interface, the user selects:

**League Format** — one of:
- Regular
- Regular-3WR
- Double Flex

Exact roster slot counts per format, and the Kicker/Defense on-off toggles, are defined as seeded data in `docs/datamodel.md` — not hardcoded here, since they're expected to keep changing as the roster design is refined.

**Auction Budget** — user selects or enters a total auction budget (e.g. $200).

The selected league format determines the available roster positions. Roster configuration must be represented as configurable data (not hard-coded throughout the application), since new formats may be added later.

## Draft / Roster Interface

The user selects a player from the available player list. When a player is selected:

1. The player is assigned to an available roster position.
2. The player's calculated auction value is added to the team's total spending.
3. Remaining budget is recalculated.
4. The roster display updates.
5. The player is marked as selected/drafted.

The application must prevent assigning a player when no appropriate roster position is available.

A player must not be selectable for the roster multiple times.

Assignment is fully automatic — there is no manual bid/price entry in MVP. The amount added to team spending is always the player's calculated combined auction value at the moment of assignment (a frozen snapshot; it does not change retroactively if valuations are updated later).

A drafted player can be un-drafted (e.g. by clicking their name in the occupied roster slot). Un-drafting removes the roster assignment, frees the slot, subtracts the player's price from spent so remaining budget updates accordingly, and returns the player to the available pool in its original (non-drafted) state. This does not affect favorited status — favoriting and roster-drafted status remain independent flags per the Favorites section below.

The UI should clearly visually distinguish:
- Available players
- Drafted/selected players
- Favorited players

## Budget Tracking

Display, at minimum:

- Total Budget
- Spent
- Remaining Budget

Example:

```
Budget: $200
Spent: $117
Remaining: $83
```

Overspending is allowed, not blocked — a player selection is never prevented for exceeding the remaining budget. If total spending exceeds the budget, Remaining Budget simply displays as negative. Revisit this if stricter budget enforcement is wanted later.

## Favorites

- Users can favorite/unfavorite players.
- Favorited players are displayed in a separate section/list.
- Favoriting a player must **not** automatically add them to the roster.
- Selecting a player for the roster must **not** automatically favorite them.
- Favorites and roster-drafted status are independent flags on a player.

## Architecture Principles

Keep the following concerns separated, both conceptually and in code organization:

- Player data
- League configuration
- Roster state
- Auction calculations
- Favorites
- UI components

Business logic (auction math, roster assignment rules, budget calculations) must **not** be embedded directly inside UI components — it belongs in dedicated modules/services/hooks that UI components consume.

Keep ESPN/Yahoo data ingestion isolated from the core application so it can be built, tested, and swapped in independently of the mock data layer.

**Data model:** the full entity/relationship design (Position, ValuationSource, LeagueFormat, RosterPositionSlot, Player, PlayerValuation, and the frontend-only session state) lives in `docs/datamodel.md`. Consult it before writing schema, migrations, or seed data — it also documents which roster/format decisions are finalized versus still open.

## Frontend Structure

Development starts with the frontend, built entirely against mock data — no Express or Postgres required yet. `src/` should follow this layout:

```
src/
├── components/
│   ├── PlayerList/
│   ├── PlayerCard/
│   ├── PlayerFilters/
│   ├── FavoritesList/
│   ├── Roster/
│   ├── RosterSlot/
│   ├── BudgetDisplay/
│   └── LeagueSelector/
│
├── pages/
│   ├── Setup/
│   └── Draft/
│
├── hooks/
│   ├── useDraftSession.ts
│   ├── useRoster.ts
│   └── useFavorites.ts
│
├── data/
│   ├── mockPlayers.ts
│   └── leagueFormats.ts
│
├── types/
│   ├── Player.ts
│   ├── League.ts
│   └── Roster.ts
│
├── services/
│   ├── playerService.ts
│   └── leagueService.ts
│
└── utils/
    ├── auctionCalculations.ts
    ├── budgetCalculations.ts
    └── rosterAssignment.ts
```

Notes on intent, not just layout:

- **`services/`** is the seam between the frontend and the backend. `playerService.ts` / `leagueService.ts` expose the function signatures a component calls (`getPlayers()`, `getLeagueFormats()`); they now call the real Express API (`/api/players`, `/api/league-formats`) via `fetch()`, routed through Vite's dev proxy. No component should import `data/` files directly — those files are no longer bundled into the frontend at all; they're read only by `server/seed/seed.ts` as the single source of truth for seeding Postgres.
- **`utils/`** holds the three business-logic categories called out under Architecture Principles — auction math, roster assignment rules, budget calculations — as separate, independently testable modules rather than one catch-all file.
- **`hooks/`** is the client-side home for the session state described under Session Isolation & State Persistence (draft session config, roster assignments, favorites). Components read/write this state through hooks, not local component state, since multiple components share it.
- **`data/leagueFormats.ts`** holds roster/format config as data (mirroring `docs/datamodel.md`'s `LeagueFormat`/`RosterPositionSlot` shape), consistent with the rule that roster configuration must never be hardcoded — that applies even before Postgres exists.
- A router is not required for two pages (Setup, Draft); prefer simple state-driven conditional rendering unless a real need for URL-based navigation emerges, per "do not introduce unnecessary dependencies."

## Backend Structure

The backend lives in its own top-level `server/` folder, separate from `src/` — it holds only the database layer (and, next, the Express API); it never holds draft-progress state, per Session Isolation below.

```
server/
├── db/
│   ├── pool.ts          # single pg Pool from DATABASE_URL; fails fast if unset
│   └── migrate.ts       # SQL migration runner (schema_migrations ledger)
├── migrations/
│   └── 001_initial_schema.sql
└── seed/
    ├── lookups.ts       # Position + ValuationSource rows (see note below)
    └── seed.ts          # truncate + insert from src/data/*.ts, one transaction
```

Extension points for the next pass: `server/index.ts` (Express bootstrap), `server/routes/`, `server/services/` (the query layer the routes call).

Notes on intent:

- **Tooling stays minimal.** Plain SQL migration files plus the `pg` driver — no ORM. The reference data is a handful of small tables with no complex relations or runtime schema evolution, so an ORM would add a dependency, a DSL, and a codegen step to buy nothing here. The migration runner is a small hand-rolled script, not a library.
- **Primary keys:** DB-generated identity ints, with real uniqueness enforced on the natural/business keys (`league_format.key`, `(league_format_id, slot_label)`, `(player_id, source, season_year)`, `espn_player_id`/`yahoo_player_id`). This matches `docs/datamodel.md`, which lists `id` and `key` as separate fields on `LeagueFormat` — a surrogate key plus a natural key, not one field doing both jobs. Mock-data string ids (`'p1'`, `'regular-qb'`) are intentionally not carried into the database as primary keys, since they're meaningless once real ESPN/Yahoo ingestion replaces the mock data — exactly the "no structural rework" swap-in path the Development Strategy calls for.
- **`eligible_positions` is a join table** (`roster_slot_eligible_position`), not an array column, so a typo'd position code is rejected by a foreign key rather than inserted silently — the same referential-integrity reasoning `docs/datamodel.md` already gives for making `Position` a lookup table rather than an enum.
- **The seed script imports `src/data/*.ts` directly** (via `tsx`, since Node can't execute TypeScript natively) so there is exactly one source of truth for mock data — no hand-authored duplicate to drift out of sync. `Position` and `ValuationSource` rows are the one exception (`server/seed/lookups.ts`): they exist in the frontend only as TypeScript union types, which are erased at runtime, so there's nothing in `src/` to read them from. The seed validates every position/source code it encounters against `lookups.ts` and aborts on a mismatch, to catch drift between the two.
- **Seeding is truncate-and-reinsert, not upsert**, and that's safe specifically because of Session Isolation: nothing user-owned or session-specific lives in these tables, so they're wholly derived from the source files and fully disposable. Real ingestion later will upsert on `espn_player_id`/`yahoo_player_id` instead, per the swap-in path in `docs/datamodel.md`.
- **No combined-value column, ever.** Combined auction value stays derived from `player_valuation` rows at read time — enforced by convention now, worth a quick `information_schema` check after any future migration touching `player` or `player_valuation`.

## Session Isolation & State Persistence

This is a personal tool without user accounts at MVP, but one user's session (or browser tab) must never affect another's. This is achieved structurally, not by adding session-scoping code:

- `drafted` status, `favorited` status, roster assignments, and remaining budget are **never** written to the `Player` table or any other shared/server-side reference data. They exist only as client-side (React) state for the current browser session.
- The Express backend must remain stateless with respect to draft progress. It should only ever serve read-only reference data (players, league formats, roster slot configs) and must not hold any in-memory global variable or cache representing "the current draft." No draft-related write ever reaches the server.
- Because nothing session-specific is stored server-side, isolation between users/tabs/devices falls out of the architecture automatically — there is no shared mutable state to leak across sessions.

**Optional enhancement:** to avoid losing an in-progress draft on an accidental page refresh, draft state (roster assignments, favorites, budget) can be persisted to the browser's `localStorage`. This keeps state local to that one browser/device — it does not touch the server and does not compromise session isolation, since `localStorage` is never shared across browsers or users. This is not required for MVP and can be added at any point without a backend change.

When user accounts and saved builds are introduced (Post-MVP), this client-side state maps directly onto server-side, user-owned records (e.g. a `DraftBuild` scoped to a `User`) — no structural rework needed, just relocation.

## Development Rules

- Use TypeScript throughout (frontend and backend).
- Prefer small, reusable components.
- Do not introduce unnecessary dependencies.
- Do not modify unrelated files.
- Explain architectural changes before making major changes.
- Write tests for important business logic (auction value calculation, budget math, roster assignment rules, favorites toggling).
- Keep ESPN/Yahoo data ingestion separate from the core application until the core app is functional on mock data.

## Post-MVP / Future Features

Not part of the initial build — implement only after the above is working:

- User sign-in / authentication
- Saving and loading a user's team build