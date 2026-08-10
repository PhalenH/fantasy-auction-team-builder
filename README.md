# Fantasy Auction Draft Assistant

A web app for prepping and running a fantasy football auction draft. It brings together ESPN and Yahoo auction values, your league's roster rules, and your budget in one place, so you're not juggling spreadsheets and multiple browser tabs on draft day.

## What it does

- **Compares auction values.** Every player shows ESPN and Yahoo auction averages side by side, plus a calculated combined value, so you can spot where the two sources disagree.
- **Adapts to your league.** Choose a league format (Regular, Regular-3WR, or Double Flex) and toggle Kicker/Defense on or off — the available roster slots update automatically.
- **Tracks your budget in real time.** Set your auction budget, then draft players into open roster slots. Spending and remaining budget update automatically using each player's combined value; a pick can be undone at any time, which frees the slot and restores the budget.
- **Filters and sorts the player pool.** Browse by position, sorted by combined value (most expensive first), so the top targets at each position are always easy to find.
- **Keeps a favorites shortlist.** Star players to track separately from the main board — favoriting is independent of drafting, so starring someone doesn't take them off the board for anyone else's plans.

## Status

Currently running on seeded/mock player data rather than live ESPN/Yahoo feeds, so the full draft experience — format selection, budgeting, drafting, favorites — works end to end today, with real data ingestion planned as a later phase. Built with React, TypeScript, and Tailwind CSS on the frontend, with a Node/Express/PostgreSQL backend to come.