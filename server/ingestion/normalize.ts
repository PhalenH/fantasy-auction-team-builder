// Name normalization for the Player match key. Real ingestion has no ID to
// match incoming rows against existing Player rows — matching is on
// (name, position) instead (docs/datamodel.md, "Real ingestion") — so this
// is the piece doing the most unforced work in the whole pipeline: it's the
// only thing standing between a formatting difference (a dropped period, a
// stray space) and a false non-match that creates a duplicate Player row.
//
// Concrete example from the real source data: mockPlayers.ts has
// "Amon-Ra St. Brown" but the auction-value CSV has "Amon-Ra St Brown" (no
// period) — normalizing both strips the period and collapses the resulting
// double space, so they match.

export function normalizePlayerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['"’‘.]/g, '')
    .replace(/\s+/g, ' ')
}

export function playerMatchKey(name: string, position: string): string {
  return `${normalizePlayerName(name)}|${position}`
}
