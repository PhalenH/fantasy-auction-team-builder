# Manual Bid Entry — Design & Scope

Replaces the "fully automatic" assignment behavior currently described in `CLAUDE.md`'s Draft/Roster Interface section, where the amount added to spending is always the calculated combined auction value. This adds the ability to enter a custom price at the moment of assignment.

## 1. Data model — no schema change needed

`RosterAssignment.price_paid` already exists in `docs/datamodel.md` as exactly the field this feature needs: `{ slot_instance_id, player_id, price_paid }`. It was already designed to hold *a* price at assignment time — the only change is **who sets that value**. Today it's always auto-set to the calculated combined value; this feature makes it user-editable at the point of assignment, with the calculated value as the starting default rather than the forced value.

Since `RosterAssignment` is frontend-only session state (per Session Isolation in `CLAUDE.md`), this is a frontend/business-logic change only — no migration, no backend change.

## 2. Design — confirmed: edit after assignment, not during it

Based on your roster screenshot: assignment itself stays exactly as it is today — a player is added to a slot at the calculated combined value, automatically, no interruption to the current selection flow. The new capability is **editing the price of an already-assigned player from the roster view**, where prices are already displayed per slot (`$9.00`, `$60.00`, etc. in your screenshot).

This is a meaningfully simpler scope than editing-at-draft-time: it doesn't touch the player-selection/assignment flow at all (no need to reverse-engineer that flow first), it only adds an edit affordance to the `RosterSlot` display, which already renders the price.

**Recommended control — combine your two ideas into one:** a single editable price field that behaves like a stepper input:
- Normally displayed as static text (as it is now).
- An edit (pencil) icon toggles it into an editable state.
- While editing: up/down arrow buttons step the value by $0.50 per click (satisfies the "increase/decrease arrow" idea), **and** the value is also directly typable for jumping straight to a specific number (satisfies the "edit button" idea) — a native `<input type="number" step="0.5">`, styled to match the app, gives both for free rather than building two separate controls.
- Confirm on blur or Enter; cancel on Escape without saving.
- Validate on confirm: reject or round to the nearest valid increment (see Validation below), enforce the $1 minimum.

If you'd rather keep the two ideas fully separate (dedicated edit-mode toggle *and* always-visible +/- arrows even outside edit mode), that's also reasonable — flag if you want that instead of the combined control.

**What changes under the hood:**
- **New function** in `utils/rosterAssignment.ts` (or wherever `price_paid` is currently written) — something like `updateAssignmentPrice(slotInstanceId, newPrice)` — distinct from the existing assign function, since this edits an existing `RosterAssignment` rather than creating one.
- **`hooks/useRoster.ts`** exposes this update function to components.
- **`RosterSlot` component** gets the edit control described above.
- **Budget recalculation** — `Spent`/`Remaining` at the top of the Roster panel must reflect an edited price immediately, the same way it reflects a fresh assignment. Since these are already derived from summing `price_paid` across assignments, this should fall out automatically once the assignment's price actually changes — worth an explicit check rather than an assumption, since it's easy to accidentally update local component state without triggering the same recalculation path.

## 3. Validation — confirmed

- **Minimum bid: $1.**
- **Increments: whole dollars or $0.50 only** — matches the fact that every calculated combined value in the app is either a whole number or lands on `.50` (e.g. `$43.50`), so the input shouldn't support precision the underlying data never has. A typed/stepped value of e.g. `$9.25` should be rejected or rounded to the nearest valid increment.
- **No maximum / no budget-based cap.** Consistent with "overspending is allowed, not blocked" — editing a price is never rejected for exceeding remaining budget.
- Editing must be cancelable without committing a change.

## 4. Unaffected (confirming these explicitly since it's easy to accidentally break them)

- **Un-drafting** — already subtracts whatever `price_paid` was on the assignment; this continues to work unchanged whether that price was auto-calculated or manually entered.
- **Combined auction value display** in the player list/pool — still shown as reference/estimate for sorting and as the bid-entry default. Not replaced by anything.
- **Frozen-snapshot behavior** — a manually entered price is just as frozen as an auto-calculated one; it doesn't change retroactively if `PlayerValuation` rows are updated by a later ingestion run.
- **Favorites** — untouched, no interaction with pricing at all.

## 5. `CLAUDE.md` update needed

The Draft/Roster Interface section currently states: *"Assignment is fully automatic — there is no manual bid/price entry in MVP."* Replace with something like: assignment remains automatic at the calculated combined value; once assigned, the price can be edited from the roster view (whole-dollar or $0.50 increments, $1 minimum) via the `RosterSlot` edit control. Un-drafting and the frozen-snapshot behavior (edits aren't affected retroactively by later valuation updates) are otherwise unchanged.

## 6. Testing

Per `CLAUDE.md`'s rule on testing important business logic: the assignment function's new price-handling path (accepting an explicit price, defaulting when none given, rejecting sub-$1 values) is exactly the kind of thing that belongs in `utils/` tests, not just manual UI testing.

## 7. Scope locked

Both prior open items are resolved: validation is whole-dollar/$0.50 increments with a $1 minimum, and the edit happens post-assignment on the roster view via a combined stepper/typable control — not during the selection flow. Ready for the Claude Code prompt below.
