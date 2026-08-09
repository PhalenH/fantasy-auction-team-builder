# Data Model — Fantasy Auction Draft Assistant

Entity/relationship design only — no SQL or application code. Reflects the original design plus the round of clarifying Q&A that resolved roster composition, K/DST inclusion, and bench behavior.

## Entities

### Reference / configuration data (server-authoritative, shared by all users)

**Position** — lookup table, not a hardcoded enum
- `code` (QB, RB, WR, TE, K, DST)
- `display_name`

Both `Player.position` and roster-slot eligibility reference this same table, so there's one vocabulary instead of two enums that can drift out of sync.

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
- `eligible_positions` (set of Position codes that can fill this slot — e.g. FLEX → {RB, WR, TE})
- `sort_order`
- `toggle_key` (nullable) — **new field.** `'kicker'` on the K slot, `'defense'` on the DST slot, `null` on every other slot (always included). See "Kicker/Defense toggles" below.

### Player data

**Player**
- `id`
- `name`
- `nfl_team`
- `position` (FK → Position)
- `bye_week`
- `espn_player_id` (nullable) / `yahoo_player_id` (nullable) — reserved now, populated later by real ingestion for matching

Positions in scope for MVP: **QB, RB, WR, TE, K, DST** (K/DST confirmed in-scope, but their roster slots are toggle-gated — see below).

**PlayerValuation** — one row per (player, source)
- `id`
- `player_id` (FK → Player)
- `source` (FK → ValuationSource)
- `auction_value`
- `season_year`
- `updated_at`

Combined/calculated value is **not** a stored column — it's derived by a service that computes the mean of a player's `PlayerValuation` rows on read (or a cached/materialized value later, without changing the underlying shape).

`season_year` is included preemptively for when real data is seasonal. There's no history/versioning table yet — each ingestion upserts the current value. If historical auction-value snapshots are wanted later, that's a straightforward additive table, not a rework.

### Frontend-only / session state (never persisted server-side)

**DraftSession** (conceptual — lives in React state, not the database)
- `league_format_id`
- `budget`
- `defense_enabled: boolean` — **new**, set at league-setup time, same tier/lifecycle as the budget input
- `kicker_enabled: boolean` — **new**, same as above

**RosterAssignment** (frontend list): `{ slot_instance_id, player_id, price_paid }` — determines "drafted" status by membership. `price_paid` is set automatically to the player's calculated combined auction value at the moment of assignment (a frozen snapshot) — there is no manual bid-entry UI in MVP, and the value never changes retroactively if the underlying `PlayerValuation` rows are updated later.

**Favorites**: a frontend id-set — determines "favorited" status by membership.

Neither `RosterAssignment` nor favorites ever get written back to `Player` or any shared table — see the Session Isolation rule in CLAUDE.md.

## Relationships

- `LeagueFormat` 1──* `RosterPositionSlot` *──* `Position` (via `eligible_positions`)
- `Player` *──1 `Position`
- `Player` 1──* `PlayerValuation` *──1 `ValuationSource`
- Nothing here references a `User` — there isn't one yet.

## Roster composition (seeded data, not code)

All three formats share the same six base slot types (QB/RB/WR/TE/FLEX/BENCH) plus the two toggle-gated slots (K/DST). Only the row values differ per format — adding or changing a format is a data edit, never a code change.

| Format | Slots |
|---|---|
| Regular | QB1 / RB2 / WR2 / TE1 / FLEX1 (RB/WR/TE) / BENCH7 |
| Regular-3WR | QB1 / RB2 / WR3 / TE1 / FLEX1 (RB/WR/TE) / BENCH7 |
| Double Flex | QB1 / RB2 / WR2 / TE1 / FLEX2 (RB/WR/TE) / BENCH7 |

Every format also gets one K slot (`toggle_key='kicker'`) and one DST slot (`toggle_key='defense'`).

## Kicker/Defense toggles

K and DST are not properties of a format (any of the four formats can run with K/DST on or off independently), so they aren't baked into format-specific slot rows the way QB/RB/WR are:

1. `RosterPositionSlot.toggle_key` tags the K and DST slots (`'kicker'` / `'defense'`); every other slot is `null` (always active).
2. `DraftSession` (frontend state) carries `defense_enabled` / `kicker_enabled`, set at league-setup time — not persisted server-side.
3. A slot is part of the active roster for a session if `toggle_key` is `null`, or if the session's corresponding toggle is on. Assignment/validation logic reads this generically — no format- or position-specific branching in code.
4. Hiding K/DST players from the pool when their toggle is off is a UI-layer filter on the existing `Position` field — no model change needed.

## Bench slots

`RosterPositionSlot(slot_label='BENCH', count=7, eligible_positions=ALL)`. Position-agnostic (any drafted player can occupy a bench slot) and, like every slot, `count` is a capacity ceiling, not a fill requirement — you're equally not forced to fill QB1 today. "7 bench slots, none required" needed no schema change; it's the existing count-based capacity behavior already in the model.

## Budget presets

Treated as a UI-layer concern (constants), not modeled data — unlike roster format, preset amounts (e.g. "$200") don't change app structure. Revisit if presets should become admin-configurable data too.

## Lookup tables vs. enums

`Position` and `ValuationSource` are small reference tables rather than hardcoded enums, for referential integrity and easy extension (e.g. adding a new valuation source later needs no code enum change). A plain TypeScript union type would technically satisfy CLAUDE.md's letter too, but is less flexible — kept as lookup tables.

## Swap-in path for real ESPN/Yahoo data

Real ingestion just needs to write into the same `PlayerValuation` table the seed script writes into, matched to existing `Player` rows via `espn_player_id`/`yahoo_player_id` (or created if new). Because ingestion and mock-seeding both terminate at the identical table shape, replacing one with the other is a data-source swap, not a structural one.

## Budget enforcement

Overspending is **allowed, not blocked**. `validateAssignment` (utils/rosterAssignment.ts) only checks slot eligibility/capacity — it does not compare price against remaining budget. `getRemainingBudget` (utils/budgetCalculations.ts) is deliberately unclamped, so remaining budget can go negative if calculated values exceed the total. This is a deliberate MVP simplification, decided when the business-logic layer surfaced that neither this doc nor CLAUDE.md had specified a policy either way.

## Resolved this round

- Formats finalized at three: `regular`, `regular_3wr`, `double_flex` (`super_flex` was considered, then removed — not part of MVP scope).
- Regular-3WR keeps FLEX in addition to the 3rd WR slot (not a replacement).
- K/DST are in-scope positions but session-level on/off toggles, not fixed per format.
- Bench is 7 slots, position-agnostic, none required — required no schema change.
- Budget presets are UI-layer, not modeled data.
- `price_paid` is auto-set to the calculated combined value at assignment time (no manual bid entry in MVP).
- Overspending the budget is allowed, not blocked (see "Budget enforcement" above).

## Still open

Nothing outstanding from this round.