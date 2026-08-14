# Saved Rosters — Design Plan

Entity/flow design for the third page (Saved Rosters), extending the existing frontend-only
state pattern (`DraftSession`, `RosterAssignment`, `Favorites`). No server or schema changes.

## Decisions (this round)

- **Save is enabled only when the roster is 100% full** — every active slot instance for the
  current format, including all 7 BENCH slots and any toggle-gated K/DST slots that are on.
  Not just the starting lineup.
- **Cap of 6 saved rosters.** At cap, saving does not block — it opens a picker of the 6
  existing saves so the user can choose one to overwrite.
- **Saves are resumable.** Loading a save doesn't just display it — it hydrates an active
  draft session so the user can keep editing (swap a player, adjust a price, etc.).
- **Persistence: `localStorage`, not `sessionStorage`.** `sessionStorage` clears when the tab
  closes, which fails the core requirement (persist across closing the tab/browser on mobile
  or desktop). If the in-progress draft session currently uses `sessionStorage` for
  refresh-survival, that's a separate, narrower concern — confirm it isn't reused here.

## New entity: `SavedRoster` (frontend-only)

Same tier as `DraftSession`/`RosterAssignment`/`Favorites` — lives in the browser, never
touches Postgres or Express, so Session Isolation is unaffected.

```
SavedRoster {
  id: string              // uuid, generated client-side
  name: string             // user-entered at save time, or auto-generated
  savedAt: string           // ISO timestamp
  leagueFormatKey: string
  budget: number
  defenseEnabled: boolean
  kickerEnabled: boolean
  totalSpent: number
  remainingBudget: number
  assignments: {
    slotLabel: string
    slotInstanceId: string   // distinguishes e.g. BENCH1 vs BENCH2
    playerId: number
    playerName: string        // denormalized snapshot
    playerTeam: string        // denormalized snapshot
    playerPosition: string    // denormalized snapshot
    pricePaid: number         // frozen, same convention as live RosterAssignment
  }[]
}
```

Denormalizing player name/team/position (not just `playerId`) matters specifically because
of the `(name, position)` ingestion match key documented in `datamodel.md`: a trade rewrites
`team_code` on the same `Player` row, but a name-formatting mismatch on a future ingestion run
can create a *new* row for the same real person. A save should still render correctly months
later even if the `playerId` it references has drifted.

Storage: single `localStorage` key (e.g. `savedRosters`) holding the array of up to 6 —
read/written as one JSON blob, not per-item keys.

## Completeness check

New util, e.g. `utils/rosterCompleteness.ts`:

```
isRosterComplete(assignments, activeSlotInstances): boolean
```

`activeSlotInstances` is derived the same way the existing toggle logic already resolves
active slots (`toggle_key` null, or the session's `defense_enabled`/`kicker_enabled` on) —
reuse that resolution rather than duplicating it. Returns true only when every active slot
instance has a matching assignment. Drives the Save button's enabled state on the Draft page.

## Save flow

1. Draft page computes `isRosterComplete(...)` on every roster change; Save button reflects it.
2. On click:
   - **If fewer than 6 saves exist:** prompt for a name (default to something like
     "Draft — {date}"), create a new `SavedRoster`, append, persist.
   - **If 6 saves already exist:** show a picker listing all 6 (name, saved date, format,
     spend) — user selects one to overwrite, optionally renames it, confirms — the selected
     entry is replaced in place (same array position or re-sorted by date, either is fine).

## Resume flow

1. From the Saved Rosters page, "Resume" on a card navigates to the Draft page.
2. If the current draft has any unsaved progress, `confirm()` before proceeding (simple
   native confirm is enough at this scale — no dedicated modal needed).
3. Hydrate: set league format / budget / K-D toggles from the save, wait for the player pool
   to load, then for each assignment:
   - If `playerId` resolves in the live pool → mark that player drafted, occupy the slot at
     the saved `pricePaid` (not recalculated from current valuations — same "frozen snapshot"
     rule as normal assignment).
   - If `playerId` does not resolve (edge case above) → still occupy the slot using the
     denormalized snapshot fields, so budget math and slot occupancy stay correct. This
     assignment won't be linked back to a live pool row, but remains editable/un-draftable
     like any other roster slot.
4. Favorites are **not** restored — a save captures roster/budget state only, not the
   favorites list, consistent with favorites being a separate flag elsewhere in the app.
5. After resuming, the next "Save" goes through the normal flow above (new save if under 6,
   overwrite picker if at 6) — it does not silently overwrite the save it was loaded from.
   Keeps save behavior single and predictable rather than adding an implicit "update this save"
   mode.

## Delete flow

Remove by `id` from the `localStorage` array. Recommend a lightweight confirm before delete
since there's no undo — doesn't need to be more than that.

## New / changed files

```
src/
├── hooks/
│   └── useSavedRosters.ts     # list/save/delete against localStorage, enforces cap of 6
├── pages/
│   └── SavedRosters/           # 3rd page: card grid, Resume + Delete actions
├── components/
│   └── SavedRosterCard/
└── utils/
    └── rosterCompleteness.ts  # isRosterComplete(), reuses existing slot-toggle resolution
```

`useRoster.ts` / the Draft page gain a hydration entry point (e.g. `loadFromSavedRoster()`)
for step 3 of the resume flow above.

## Open judgment calls (flagging, not deciding)

- **Navigation for the 3rd page:** recommend keeping the existing state-driven conditional
  rendering (`page: 'setup' | 'draft' | 'saved'`) rather than introducing a router — there's
  no stated need for bookmarkable/shareable URLs, and this keeps in line with "do not
  introduce unnecessary dependencies." Revisit if that changes.
- **Favorites in saves** — currently excluded (see Resume flow, step 4). Say the word if you
  want a save to also snapshot the favorites list.
- **Resume confirmation** — currently a plain `confirm()` when overwriting in-progress work.
  Flagging in case that's more or less friction than you want.

## Path to the cross-device nice-to-have (not built now)

If this ever needs to work across devices, the shape here swaps in cleanly: a `SavedRoster`
table in the already-existing Postgres, upserted from the identical shape, addressable by a
generated ID (or later a real `User`) instead of a `localStorage` key. Same "no structural
rework, just relocation" property CLAUDE.md already calls for with `DraftBuild` — nothing
here needs to be redesigned to get there later.
