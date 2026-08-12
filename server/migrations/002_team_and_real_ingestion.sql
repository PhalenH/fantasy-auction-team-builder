-- Adds the Team lookup table and updates Player for real ingestion.
-- See docs/datamodel.md ("Migration note") and docs/ingestion_plan_final.md
-- for the decisions behind this round's schema change.
--
-- SCOPE: schema only, no data. Team rows are populated by
-- server/seed/lookups.ts (mock/dev-fallback path) or server/ingestion/run.ts
-- (real path), not here.

-- ---------------------------------------------------------------------------
-- Team lookup table
-- ---------------------------------------------------------------------------

-- Same referential-integrity reasoning as `position`: a typo'd team code is
-- rejected by a foreign key instead of silently inserted, and a bye-week
-- schedule correction is one row update instead of a sweep across every
-- player on that team.
CREATE TABLE team (
  code         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  bye_week     INTEGER NOT NULL CHECK (bye_week BETWEEN 1 AND 22)
);

-- ---------------------------------------------------------------------------
-- Player: nfl_team/bye_week -> team_code FK
-- ---------------------------------------------------------------------------

-- Nullable: this migration is schema-only (no data backfill), so a table
-- that already has player rows must not be broken by a NOT NULL column with
-- no default. server/seed/seed.ts and server/ingestion/run.ts both always
-- populate it on write; nothing in the application treats a NULL team_code
-- as a valid, displayable player.
ALTER TABLE player ADD COLUMN team_code TEXT REFERENCES team (code);

-- Supports team-based filtering/joins the same way player_position_code_idx
-- supports position filtering.
CREATE INDEX player_team_code_idx ON player (team_code);

-- bye_week moves to `team.bye_week`, read via the team_code join — no longer
-- copied onto every player row (docs/datamodel.md, Player entity).
ALTER TABLE player DROP COLUMN nfl_team;
ALTER TABLE player DROP COLUMN bye_week;

-- Real ingestion's match key, replacing the retired espn_player_id/
-- yahoo_player_id uniqueness: the actual source has no such ids and never
-- will, so matching (and therefore uniqueness) moves to (name, position).
ALTER TABLE player ADD CONSTRAINT player_name_position_code_key UNIQUE (name, position_code);
