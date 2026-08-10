-- Initial schema — translation of docs/datamodel.md into Postgres.
--
-- SCOPE: server-authoritative REFERENCE DATA ONLY.
--
-- Per CLAUDE.md's Session Isolation rule, draft progress (drafted status,
-- favorited status, roster assignments, spent/remaining budget) lives only
-- in frontend React state and is never written server-side. So there is
-- deliberately no user, roster_assignment, favorite, or draft_session table
-- here — and no per-session column on player. Nothing below is writable by
-- a draft; isolation between users/tabs falls out of there being no shared
-- mutable state to leak.
--
-- Combined/calculated auction value is deliberately NOT a column anywhere.
-- It is derived from a player's player_valuation rows on read
-- (utils/auctionCalculations.ts today, the API layer later).

-- ---------------------------------------------------------------------------
-- Lookup tables
-- ---------------------------------------------------------------------------

-- Lookup table rather than an enum, so Player.position and roster-slot
-- eligibility share one vocabulary that cannot drift, and so new codes need
-- no schema/code change (docs/datamodel.md, "Lookup tables vs. enums").
CREATE TABLE position (
  code         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL
);

-- Auction-value providers: espn/yahoo today, later nfl, custom_projection...
CREATE TABLE valuation_source (
  code         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- League configuration
-- ---------------------------------------------------------------------------

-- Seeds three finalized formats: regular, regular_3wr, double_flex.
-- `key` is the stable business identifier (what the API exposes and the
-- frontend persists); `id` is an internal surrogate for foreign keys.
CREATE TABLE league_format (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);

-- The roster template for a format. Adding or changing a format is a data
-- edit here, never a code change (CLAUDE.md: roster configuration must be
-- configurable data).
--
-- toggle_key tags the K/DST slots ('kicker'/'defense') so a session can
-- include or exclude them; NULL means the slot is always active. K/DST are
-- session-level toggles rather than format properties, which is why they
-- are a column here and a boolean in frontend DraftSession state.
--
-- NOTE: `count` is a Postgres col_name_keyword. It is legal as a column
-- name (kept to match docs/datamodel.md), but quote it as "count" when
-- selecting it bare to avoid the parser treating it as the aggregate.
CREATE TABLE roster_position_slot (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  league_format_id INTEGER NOT NULL REFERENCES league_format (id) ON DELETE CASCADE,
  slot_label       TEXT NOT NULL,
  count            INTEGER NOT NULL CHECK (count > 0),
  sort_order       INTEGER NOT NULL,
  toggle_key       TEXT CHECK (toggle_key IN ('kicker', 'defense')),
  -- A format cannot define the same slot type twice...
  UNIQUE (league_format_id, slot_label),
  -- ...and slot ordering within a format must be unambiguous.
  UNIQUE (league_format_id, sort_order)
);

-- Materializes the RosterPositionSlot *--* Position relationship. Modeled as
-- a join table rather than a TEXT[] column because Postgres arrays cannot
-- carry a foreign key — referential integrity on position codes is the
-- stated reason docs/datamodel.md chose a lookup table over an enum, and an
-- array would let a typo'd 'WRR' insert silently. The API layer aggregates
-- these rows back into the eligiblePositions array the frontend expects.
CREATE TABLE roster_slot_eligible_position (
  roster_position_slot_id INTEGER NOT NULL REFERENCES roster_position_slot (id) ON DELETE CASCADE,
  position_code           TEXT NOT NULL REFERENCES position (code),
  PRIMARY KEY (roster_position_slot_id, position_code)
);

-- ---------------------------------------------------------------------------
-- Player data
-- ---------------------------------------------------------------------------

-- espn_player_id/yahoo_player_id are reserved for real ingestion to match
-- against existing rows; they stay NULL under mock seeding. UNIQUE tolerates
-- many NULLs in Postgres, so it constrains only populated ids.
CREATE TABLE player (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            TEXT NOT NULL,
  nfl_team        TEXT NOT NULL,
  position_code   TEXT NOT NULL REFERENCES position (code),
  bye_week        INTEGER NOT NULL CHECK (bye_week BETWEEN 1 AND 22),
  espn_player_id  TEXT UNIQUE,
  yahoo_player_id TEXT UNIQUE
);

-- Supports the by-position filtering the player pool does.
CREATE INDEX player_position_code_idx ON player (position_code);

-- One row per (player, source, season). Real ingestion upserts on that
-- triple; there is no history table yet, which docs/datamodel.md notes would
-- be a straightforward additive change rather than a rework.
--
-- NUMERIC (not INTEGER) because real ESPN/Yahoo values are *averages* and so
-- fractional by nature, and because NUMERIC avoids float drift in the
-- derived combined value. Caveat for the API layer: the pg driver returns
-- NUMERIC as a JS string, so it must be coerced to number.
CREATE TABLE player_valuation (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id     INTEGER NOT NULL REFERENCES player (id) ON DELETE CASCADE,
  source_code   TEXT NOT NULL REFERENCES valuation_source (code),
  auction_value NUMERIC(6, 2) NOT NULL CHECK (auction_value >= 0),
  season_year   INTEGER NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, source_code, season_year)
);
