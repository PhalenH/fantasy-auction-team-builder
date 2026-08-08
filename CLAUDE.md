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

The player list should support filtering by position, and should eventually support search.

## League Setup

Before entering the draft interface, the user selects:

**League Format** — one of:
- Regular
- Regular-3WR
- Double Flex

Exact roster slot counts per format, and the Kicker/Defense on-off toggles, are defined as seeded data in `docs/data-model.md` — not hardcoded here, since they're expected to keep changing as the roster design is refined.

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

**Data model:** the full entity/relationship design (Position, ValuationSource, LeagueFormat, RosterPositionSlot, Player, PlayerValuation, and the frontend-only session state) lives in `docs/data-model.md`. Consult it before writing schema, migrations, or seed data — it also documents which roster/format decisions are finalized versus still open.

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