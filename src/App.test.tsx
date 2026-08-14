// Integration-style tests over the real component tree (App -> Setup ->
// Draft), using the real services and the real hooks/utils pipeline — this
// exercises the actual CLAUDE.md Core User Flow, not a stubbed
// approximation of it.
//
// Only the network boundary is stubbed: the services now call fetch, so
// mockApi() serves the same src/data fixtures the API itself is seeded
// from. That keeps this project fast and independent of the Express server
// and Postgres (the `server` test project covers the live round trip).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import App from './App'
import { mockApi, mockApiErrorResponse, mockApiNetworkFailure, mockApiNeverResolves } from './test/apiMock'
import type { SavedRoster } from './types/Roster'

beforeEach(() => {
  mockApi()
})

async function goToDraftPage() {
  render(<App />)

  fireEvent.click(await screen.findByRole('button', { name: 'Regular' }))
  fireEvent.click(screen.getByRole('button', { name: '$200' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start Draft' }))

  // Confirms the player pool has finished its async load before a test
  // starts interacting with it.
  await screen.findByLabelText('Draft Christian McCaffrey')
}

// The mock-data services could never fail; these can. The point of these
// tests is that a failed load says so, instead of leaving a blank screen.
describe('Setup page data states', () => {
  it('shows a loading state while league formats are in flight', () => {
    mockApiNeverResolves()
    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading league formats')
    expect(screen.queryByText('Set Up Your Draft')).not.toBeInTheDocument()
  })

  it('replaces loading with the setup form once formats resolve', async () => {
    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading league formats')

    expect(await screen.findByText('Set Up Your Draft')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regular' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an actionable error when the API returns a non-2xx response', async () => {
    mockApiErrorResponse()
    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load league formats (HTTP 503)')
    expect(alert).toHaveTextContent('docker compose up -d')
    expect(screen.queryByText('Set Up Your Draft')).not.toBeInTheDocument()
  })

  it('shows an actionable error when the request itself fails', async () => {
    mockApiNetworkFailure()
    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('the API did not respond')
    expect(alert).toHaveTextContent('npm run dev:server')
  })
})

describe('Core User Flow', () => {
  it('walks from Setup through League Format + Budget selection into the Draft page', async () => {
    render(<App />)

    // findBy, not getBy: league formats are fetched now, so Setup renders
    // after the load resolves rather than on the first paint.
    expect(await screen.findByText('Set Up Your Draft')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: 'Regular' }))
    fireEvent.click(screen.getByRole('button', { name: '$200' }))

    const startButton = screen.getByRole('button', { name: 'Start Draft' })
    expect(startButton).not.toBeDisabled()
    fireEvent.click(startButton)

    // Waits for something that only exists once the player pool has
    // actually loaded (not the "Draft" heading text alone — that also
    // renders, identically, in the transient loading state, so a plain
    // findByText('Draft') can resolve against that soon-to-be-replaced
    // node and then fail toBeInTheDocument() once the ready state swaps it
    // out a moment later).
    await screen.findByLabelText('Player pool')
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByLabelText('Budget')).toHaveTextContent('$200.00')
  })

  it('disables Start Draft until both a format and a budget are chosen', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Start Draft' })).toBeDisabled()

    fireEvent.click(await screen.findByRole('button', { name: 'Regular' }))
    expect(screen.getByRole('button', { name: 'Start Draft' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '$200' }))
    expect(screen.getByRole('button', { name: 'Start Draft' })).not.toBeDisabled()
  })

  it('drafting a player assigns a roster slot, adds spend, and updates remaining budget', async () => {
    await goToDraftPage()

    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    // McCaffrey's combined value is the mean of 58 (espn) and 55 (yahoo) = 56.5
    const roster = screen.getByLabelText('Roster')
    expect(roster).toHaveTextContent('Christian McCaffrey')
    expect(roster).toHaveTextContent('$56.50')

    const budgetDisplay = screen.getByLabelText('Budget')
    expect(budgetDisplay).toHaveTextContent('$56.50') // Spent
    expect(budgetDisplay).toHaveTextContent('$143.50') // Remaining

    expect(screen.getByLabelText('Christian McCaffrey, already drafted')).toBeDisabled()
  })

  it('favoriting a player does not draft them, and drafting a player does not favorite them', async () => {
    await goToDraftPage()

    // Favorite Justin Jefferson — must not draft him. Once favorited he
    // also appears in the Favorites section, so scope the query to the
    // player pool to keep this a single-match lookup.
    const playerPool = screen.getByLabelText('Player pool')
    fireEvent.click(within(playerPool).getByLabelText('Favorite Justin Jefferson'))
    expect(within(playerPool).getByLabelText('Draft Justin Jefferson')).not.toBeDisabled()
    expect(screen.getByLabelText('Roster')).not.toHaveTextContent('Justin Jefferson')
    expect(screen.getByLabelText('Budget')).toHaveTextContent('$0.00') // Spent

    // Draft Christian McCaffrey — must not favorite him.
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))
    // PlayerCard is reused in both PlayerList and FavoritesList, so once
    // McCaffrey is drafted his (unfavorited) star still renders in
    // PlayerList — getAllByLabelText confirms every instance is unfavorited.
    for (const star of screen.getAllByLabelText('Favorite Christian McCaffrey')) {
      expect(star).toHaveAttribute('aria-pressed', 'false')
    }

    // Jefferson's favorite status is unaffected by McCaffrey's draft, and
    // he now also appears (as a second PlayerCard instance) in the
    // Favorites section — both instances must agree he's favorited.
    for (const star of screen.getAllByLabelText('Unfavorite Justin Jefferson')) {
      expect(star).toHaveAttribute('aria-pressed', 'true')
    }
    const favoritesSection = screen.getByLabelText('Favorite players')
    expect(favoritesSection).toHaveTextContent('Justin Jefferson')
  })

  it('hides K/DST players from the pool when their toggle is off', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Regular' }))
    // Kicker defaults to enabled — turn it off; leave Defense on.
    fireEvent.click(screen.getByLabelText('Kicker'))
    fireEvent.click(screen.getByRole('button', { name: '$200' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start Draft' }))

    await screen.findByLabelText('Draft Christian McCaffrey')

    expect(screen.queryByLabelText('Draft Harrison Butker')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'K' })).not.toBeInTheDocument()

    // Defense stayed on, so the DST player is still present.
    expect(screen.getByLabelText('Draft San Francisco 49ers')).toBeInTheDocument()
  })

  it('rejects an 11th RB with a real no_open_capacity message once RB-eligible capacity is exhausted', async () => {
    await goToDraftPage()

    // Regular format's RB-eligible capacity is RB(2) + FLEX(1) + BENCH(7) =
    // 10 slots. data/mockPlayers.ts now seeds 10 RBs specifically so this
    // is reachable by real clicks through the real pipeline (validateAssignment
    // -> computeDraftResult -> draftPlayer), not a mocked onDraft.
    const rbNames = [
      'Christian McCaffrey',
      'Bijan Robinson',
      'Saquon Barkley',
      'Breece Hall',
      'Jonathan Taylor',
      'Derrick Henry',
      'Kyren Williams',
      "De'Von Achane",
      'Jahmyr Gibbs',
      'Isiah Pacheco',
    ]

    for (const name of rbNames) {
      fireEvent.click(screen.getByLabelText(`Draft ${name}`))
    }

    // All 10 successful — no rejection message yet.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const roster = screen.getByLabelText('Roster')
    for (const name of rbNames) {
      expect(roster).toHaveTextContent(name)
    }

    // The 11th RB has nowhere to go: RB/FLEX/BENCH are all full.
    fireEvent.click(screen.getByLabelText('Draft James Cook'))
    expect(screen.getByRole('alert')).toHaveTextContent('Your roster is full for this position.')
    expect(screen.getByLabelText('Draft James Cook')).not.toBeDisabled()
    expect(roster).not.toHaveTextContent('James Cook')
  })

  it('un-drafts a player by clicking their name in the roster, without touching favorited status', async () => {
    await goToDraftPage()

    // Favorite McCaffrey before drafting him, so we can confirm un-drafting
    // leaves that untouched — favorited and drafted stay independent flags.
    const playerPool = screen.getByLabelText('Player pool')
    fireEvent.click(within(playerPool).getByLabelText('Favorite Christian McCaffrey'))
    fireEvent.click(within(playerPool).getByLabelText('Draft Christian McCaffrey'))

    const roster = screen.getByLabelText('Roster')
    expect(roster).toHaveTextContent('Christian McCaffrey')
    expect(screen.getByLabelText('Budget')).toHaveTextContent('$56.50') // Spent

    fireEvent.click(screen.getByLabelText('Remove Christian McCaffrey from roster'))

    // Slot is empty again.
    expect(roster).not.toHaveTextContent('Christian McCaffrey')
    expect(roster).toHaveTextContent('Empty')

    // Spent/remaining recalculated back to zero spend / full budget.
    const budgetDisplay = screen.getByLabelText('Budget')
    expect(budgetDisplay).toHaveTextContent('$0.00') // Spent
    expect(budgetDisplay).toHaveTextContent('$200.00') // Remaining

    // Player is available again in the pool.
    expect(within(playerPool).getByLabelText('Draft Christian McCaffrey')).not.toBeDisabled()

    // Favorited status untouched by the un-draft.
    expect(within(playerPool).getByLabelText('Unfavorite Christian McCaffrey')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Favorite players')).toHaveTextContent('Christian McCaffrey')
  })

  it('editing a drafted player’s price updates the roster and recalculates the budget immediately', async () => {
    await goToDraftPage()

    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    const roster = screen.getByLabelText('Roster')
    const budgetDisplay = screen.getByLabelText('Budget')
    expect(roster).toHaveTextContent('$56.50')
    expect(budgetDisplay).toHaveTextContent('$56.50') // Spent
    expect(budgetDisplay).toHaveTextContent('$143.50') // Remaining

    fireEvent.click(screen.getByLabelText('Edit price for Christian McCaffrey'))
    const priceInput = screen.getByLabelText('New price for Christian McCaffrey')
    fireEvent.change(priceInput, { target: { value: '70' } })
    fireEvent.keyDown(priceInput, { key: 'Enter' })

    // Same derivation path a fresh assignment uses (getSpent/getRemainingBudget
    // over RosterAssignment[]) — not a separate, possibly stale local total.
    expect(roster).toHaveTextContent('$70.00')
    expect(budgetDisplay).toHaveTextContent('$70.00') // Spent
    expect(budgetDisplay).toHaveTextContent('$130.00') // Remaining
  })

  it('rounds a typed price to the nearest $0.50 increment and enforces the $1 minimum', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByLabelText('Edit price for Christian McCaffrey'))
    let priceInput = screen.getByLabelText('New price for Christian McCaffrey')
    fireEvent.change(priceInput, { target: { value: '9.25' } })
    fireEvent.keyDown(priceInput, { key: 'Enter' })
    expect(screen.getByLabelText('Roster')).toHaveTextContent('$9.50')

    fireEvent.click(screen.getByLabelText('Edit price for Christian McCaffrey'))
    priceInput = screen.getByLabelText('New price for Christian McCaffrey')
    fireEvent.change(priceInput, { target: { value: '0' } })
    fireEvent.keyDown(priceInput, { key: 'Enter' })
    expect(screen.getByLabelText('Roster')).toHaveTextContent('$1.00')
  })

  it('cancels an in-progress price edit on Escape without saving', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    const roster = screen.getByLabelText('Roster')
    fireEvent.click(screen.getByLabelText('Edit price for Christian McCaffrey'))
    const priceInput = screen.getByLabelText('New price for Christian McCaffrey')
    fireEvent.change(priceInput, { target: { value: '999' } })
    fireEvent.keyDown(priceInput, { key: 'Escape' })

    expect(roster).toHaveTextContent('$56.50')
    expect(roster).not.toHaveTextContent('$999.00')
    expect(screen.getByLabelText('Budget')).toHaveTextContent('$56.50') // Spent unchanged
  })

  it('un-drafting after a price edit subtracts the edited price, not the original calculated value', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByLabelText('Edit price for Christian McCaffrey'))
    const priceInput = screen.getByLabelText('New price for Christian McCaffrey')
    fireEvent.change(priceInput, { target: { value: '80' } })
    fireEvent.keyDown(priceInput, { key: 'Enter' })
    expect(screen.getByLabelText('Budget')).toHaveTextContent('$80.00') // Spent

    fireEvent.click(screen.getByLabelText('Remove Christian McCaffrey from roster'))

    const budgetDisplay = screen.getByLabelText('Budget')
    expect(budgetDisplay).toHaveTextContent('$0.00') // Spent
    expect(budgetDisplay).toHaveTextContent('$200.00') // Remaining
  })

  it('clearing the roster (confirmed) un-drafts every player and resets the budget, leaving favorites untouched', async () => {
    await goToDraftPage()

    const playerPool = screen.getByLabelText('Player pool')
    // Favorited before drafting, specifically so this test can confirm a
    // full roster clear leaves favorited status alone — same independence
    // a single un-draft already has (RosterAssignment and the favorites
    // id-set are separate state, per CLAUDE.md's Favorites section).
    fireEvent.click(within(playerPool).getByLabelText('Favorite Christian McCaffrey'))
    fireEvent.click(within(playerPool).getByLabelText('Draft Christian McCaffrey'))
    fireEvent.click(within(playerPool).getByLabelText('Draft Bijan Robinson'))

    const roster = screen.getByLabelText('Roster')
    expect(roster).toHaveTextContent('Christian McCaffrey')
    expect(roster).toHaveTextContent('Bijan Robinson')
    expect(screen.getByLabelText('Budget')).toHaveTextContent('$109.50') // Spent (56.50 + 53.00)

    fireEvent.click(screen.getByLabelText('Clear roster'))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Confirm')
    expect(dialog).toHaveTextContent('Clear your entire roster?')
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    // Every slot is empty again — not just the two drafted players' names
    // gone, but no leftover assignment state anywhere in the panel.
    expect(roster).not.toHaveTextContent('Christian McCaffrey')
    expect(roster).not.toHaveTextContent('Bijan Robinson')
    expect(within(roster).getAllByText('Empty').length).toBeGreaterThan(0)

    const budgetDisplay = screen.getByLabelText('Budget')
    expect(budgetDisplay).toHaveTextContent('$0.00') // Spent
    expect(budgetDisplay).toHaveTextContent('$200.00') // Remaining

    // Both players return to the available pool.
    expect(within(playerPool).getByLabelText('Draft Christian McCaffrey')).not.toBeDisabled()
    expect(within(playerPool).getByLabelText('Draft Bijan Robinson')).not.toBeDisabled()

    // Favorited status survives the clear.
    expect(within(playerPool).getByLabelText('Unfavorite Christian McCaffrey')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Favorite players')).toHaveTextContent('Christian McCaffrey')
  })

  it('canceling the clear-roster confirmation leaves the roster and favorites untouched', async () => {
    await goToDraftPage()

    const playerPool = screen.getByLabelText('Player pool')
    fireEvent.click(within(playerPool).getByLabelText('Favorite Christian McCaffrey'))
    fireEvent.click(within(playerPool).getByLabelText('Draft Christian McCaffrey'))

    const roster = screen.getByLabelText('Roster')
    expect(roster).toHaveTextContent('Christian McCaffrey')

    fireEvent.click(screen.getByLabelText('Clear roster'))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    // Nothing changed: the roster assignment, the spend, and the favorite
    // are all exactly as they were before the click.
    expect(roster).toHaveTextContent('Christian McCaffrey')
    expect(screen.getByLabelText('Budget')).toHaveTextContent('$56.50') // Spent unchanged
    expect(within(playerPool).getByLabelText('Christian McCaffrey, already drafted')).toBeDisabled()
    expect(within(playerPool).getByLabelText('Unfavorite Christian McCaffrey')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

// CLAUDE.md's Session Isolation "Optional enhancement": draft config,
// roster assignments, and favorites persist to sessionStorage so a page
// refresh doesn't reset back to Setup. "Refresh" itself is simulated by
// unmounting and re-rendering <App /> — sessionStorage (unlike React state)
// survives that, exactly like it survives a real browser refresh.
describe('sessionStorage persistence', () => {
  function readStoredSession() {
    const raw = sessionStorage.getItem('draftSession')
    expect(raw).not.toBeNull()
    return JSON.parse(raw as string)
  }

  it('persists league format, budget, a roster assignment, and a favorite as they change', async () => {
    await goToDraftPage()

    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))
    fireEvent.click(screen.getByLabelText('Favorite Bijan Robinson'))

    const stored = readStoredSession()
    expect(stored.leagueFormatId).toBe('regular')
    expect(stored.budget).toBe(200)
    expect(stored.kickerEnabled).toBe(true)
    expect(stored.defenseEnabled).toBe(true)
    expect(stored.assignments).toEqual(
      expect.arrayContaining([expect.objectContaining({ playerId: 'p3', pricePaid: 56.5 })]),
    )
    expect(stored.favoriteIds).toContain('p4')
  })

  it('a refresh mid-draft restores the Draft screen (not Setup) with the prior roster, budget, and favorites', async () => {
    const { unmount } = render(<App />)
    expect(await screen.findByText('Set Up Your Draft')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Regular' }))
    fireEvent.click(screen.getByRole('button', { name: '$200' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start Draft' }))
    await screen.findByLabelText('Draft Christian McCaffrey')

    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))
    fireEvent.click(screen.getByLabelText('Favorite Bijan Robinson'))
    unmount()

    // Re-mounting is the "refresh": a fresh App instance reading whatever
    // the first instance left in sessionStorage, with no React state
    // carried over between the two.
    render(<App />)

    // Lands directly on Draft — "Set Up Your Draft" never appears. Waiting
    // on the Roster landmark itself (not just the "Draft" h1, which the
    // loading skeleton also renders) is what actually waits for the player
    // pool's async load to finish.
    const roster = await screen.findByLabelText('Roster')
    expect(screen.queryByText('Set Up Your Draft')).not.toBeInTheDocument()
    expect(roster).toHaveTextContent('Christian McCaffrey')
    expect(screen.getByLabelText('Budget')).toHaveTextContent('$56.50') // Spent

    const playerPool = screen.getByLabelText('Player pool')
    expect(within(playerPool).getByLabelText('Unfavorite Bijan Robinson')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('falls back to a fresh Setup screen, without crashing, when the stored session is corrupted JSON', async () => {
    sessionStorage.setItem('draftSession', '{not valid json')

    expect(() => render(<App />)).not.toThrow()
    expect(await screen.findByText('Set Up Your Draft')).toBeInTheDocument()
  })

  it('falls back to a fresh Setup screen when the stored session fails basic shape validation', async () => {
    // An array, not the expected object shape.
    sessionStorage.setItem('draftSession', JSON.stringify(['regular', 200]))

    expect(() => render(<App />)).not.toThrow()
    expect(await screen.findByText('Set Up Your Draft')).toBeInTheDocument()
  })

  it('drops a persisted roster assignment for a player_id no longer in the player pool, without crashing', async () => {
    sessionStorage.setItem(
      'draftSession',
      JSON.stringify({
        leagueFormatId: 'regular',
        budget: 200,
        kickerEnabled: true,
        defenseEnabled: true,
        assignments: [
          { slotInstanceId: 'regular-rb-0', playerId: 'p3', pricePaid: 56.5 },
          { slotInstanceId: 'regular-rb-1', playerId: 'no-such-player', pricePaid: 999 },
        ],
        favoriteIds: [],
      }),
    )

    expect(() => render(<App />)).not.toThrow()

    const roster = await screen.findByLabelText('Roster')
    // The real assignment survives...
    expect(roster).toHaveTextContent('Christian McCaffrey')
    // ...the phantom one is dropped: its price is never counted, and its
    // slot ends up empty rather than stuck occupied by an unrenderable
    // player. This is a second, prune-triggered re-render after the pool
    // first loads (see Draft.tsx), so it needs its own wait rather than a
    // bare synchronous assertion right after the roster first appears.
    await waitFor(() => {
      expect(screen.getByLabelText('Budget')).toHaveTextContent('$56.50') // Spent — 999 excluded
    })
    expect(within(roster).getAllByText('Empty').length).toBeGreaterThan(0)
  })
})

// Round 2 of manual-testing feedback: guard Setup's format/budget/toggle
// change handlers directly (not the "Draft Setup" nav button — see
// App.tsx's requestSessionChange), so re-picking any of the three
// league-setup controls mid-draft can't silently leave the roster out of
// sync with the new value (an orphaned slotInstanceId for format/toggle
// changes, a confusing remaining-budget recompute for budget changes).
describe('League setup controls change guard', () => {
  it('applies immediately with no confirm dialog when nothing is drafted yet', async () => {
    await goToDraftPage()

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))
    await screen.findByText('Set Up Your Draft')
    fireEvent.click(screen.getByRole('button', { name: 'Regular - 3WR' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regular - 3WR' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('re-selecting the already-active format is a no-op, even mid-draft', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))
    await screen.findByText('Set Up Your Draft')
    fireEvent.click(screen.getByRole('button', { name: 'Regular' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('opens a ConfirmDialog when changing format mid-draft; Cancel leaves the format and roster untouched', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))
    await screen.findByText('Set Up Your Draft')
    fireEvent.click(screen.getByRole('button', { name: 'Regular - 3WR' }))

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Changing this will clear your current in-progress roster.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regular' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Start Draft' }))
    const roster = await screen.findByLabelText('Roster')
    expect(roster).toHaveTextContent('Christian McCaffrey')
  })

  it('confirming clears the in-progress roster and applies the new format', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))
    await screen.findByText('Set Up Your Draft')
    fireEvent.click(screen.getByRole('button', { name: 'Regular - 3WR' }))

    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regular - 3WR' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Start Draft' }))
    const roster = await screen.findByLabelText('Roster')
    expect(roster).not.toHaveTextContent('Christian McCaffrey')
    expect(screen.getByLabelText('Budget')).toHaveTextContent('$0.00') // Spent — cleared
  })

  it('guards a budget change mid-draft the same way, with the same shared message', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))
    await screen.findByText('Set Up Your Draft')
    fireEvent.click(screen.getByRole('button', { name: '$250' }))

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Changing this will clear your current in-progress roster.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    expect(screen.getByRole('button', { name: '$250' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Start Draft' }))
    const roster = await screen.findByLabelText('Roster')
    expect(roster).not.toHaveTextContent('Christian McCaffrey')
    expect(screen.getByLabelText('Budget')).toHaveTextContent('$250.00') // Budget — new value applied
  })

  it('re-selecting the already-active budget preset is a no-op, even mid-draft', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))
    await screen.findByText('Set Up Your Draft')
    fireEvent.click(screen.getByRole('button', { name: '$200' })) // same budget goToDraftPage already set

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('guards the Kicker toggle mid-draft; Cancel leaves it unchanged', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))
    await screen.findByText('Set Up Your Draft')
    fireEvent.click(screen.getByLabelText('Kicker')) // defaults on, per Setup.tsx

    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Kicker')).toBeChecked()
  })

  it('confirming on one control clears the roster, so a second control change in the same visit applies silently', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))
    await screen.findByText('Set Up Your Draft')

    // First control (format): confirms, which clears the roster.
    fireEvent.click(screen.getByRole('button', { name: 'Regular - 3WR' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Continue' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    // Second control (budget), same visit: no re-prompt, since
    // roster.assignments is already empty from the confirm above — no
    // separate "already confirmed" tracking needed (see App.tsx's
    // requestSessionChange).
    fireEvent.click(screen.getByRole('button', { name: '$250' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '$250' })).toHaveAttribute('aria-pressed', 'true')
  })
})

// Follow-up: the custom budget field used to guard on every keystroke
// (each onChange called the guarded handler directly). It now commits on
// blur/Enter only — see Setup.tsx's customBudgetText local state — so
// typing itself never triggers the mid-draft confirm, only the eventual
// commit does.
describe('Custom budget field commits on blur/Enter, not per keystroke', () => {
  it('typing alone never opens the guard dialog, even mid-draft', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))
    await screen.findByText('Set Up Your Draft')

    const input = screen.getByLabelText('Custom budget amount')
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.change(input, { target: { value: '25' } })
    fireEvent.change(input, { target: { value: '225' } })

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('commits on blur, applying immediately when nothing is drafted yet', async () => {
    render(<App />)
    await screen.findByText('Set Up Your Draft')

    const input = screen.getByLabelText('Custom budget amount')
    fireEvent.change(input, { target: { value: '225' } })
    fireEvent.blur(input)

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(input).toHaveValue(225)
  })

  it('commits on Enter the same way as blur', async () => {
    render(<App />)
    await screen.findByText('Set Up Your Draft')

    const input = screen.getByLabelText('Custom budget amount')
    fireEvent.change(input, { target: { value: '225' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(input).toHaveValue(225)
  })

  it('guards the eventual commit mid-draft exactly once; confirming clears the roster and applies the typed budget', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))
    await screen.findByText('Set Up Your Draft')

    const input = screen.getByLabelText('Custom budget amount')
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.change(input, { target: { value: '25' } })
    fireEvent.change(input, { target: { value: '225' } })
    fireEvent.blur(input)

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Changing this will clear your current in-progress roster.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(input).toHaveValue(225)

    fireEvent.click(screen.getByRole('button', { name: 'Start Draft' }))
    const roster = await screen.findByLabelText('Roster')
    expect(roster).not.toHaveTextContent('Christian McCaffrey')
    expect(screen.getByLabelText('Budget')).toHaveTextContent('$225.00')
  })

  it('cancelling the guard leaves the committed budget unchanged', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))
    await screen.findByText('Set Up Your Draft')

    const input = screen.getByLabelText('Custom budget amount')
    fireEvent.change(input, { target: { value: '225' } })
    fireEvent.blur(input)
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start Draft' }))
    const roster = await screen.findByLabelText('Roster')
    expect(roster).toHaveTextContent('Christian McCaffrey')
    expect(screen.getByLabelText('Budget')).toHaveTextContent('$200.00') // Spent — unchanged, still $200 budget
  })

  it('re-blurring without further edits after a confirmed commit does not re-open the dialog', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))
    await screen.findByText('Set Up Your Draft')

    const input = screen.getByLabelText('Custom budget amount')
    fireEvent.change(input, { target: { value: '225' } })
    fireEvent.blur(input)
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Continue' }))

    fireEvent.blur(input) // same committed value — a no-op, per requestSessionChange's equality check
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('Draft Setup navigation', () => {
  it('navigates straight to Setup with no confirm dialog, even mid-draft (only the format handler is guarded)', async () => {
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Christian McCaffrey'))

    fireEvent.click(screen.getByRole('button', { name: 'Draft Setup' }))

    expect(await screen.findByText('Set Up Your Draft')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('Resume flow goes through ConfirmDialog, not window.confirm', () => {
  const SAVED_ROSTERS_KEY = 'savedRosters'

  afterEach(() => {
    localStorage.clear()
  })

  function seedSavedRoster(): void {
    const saved: SavedRoster = {
      id: 'save-1',
      name: 'My Great Team',
      savedAt: '2026-08-01T00:00:00Z',
      leagueFormatKey: 'regular',
      budget: 200,
      defenseEnabled: true,
      kickerEnabled: true,
      totalSpent: 56.5,
      remainingBudget: 143.5,
      assignments: [
        {
          slotLabel: 'RB',
          slotInstanceId: 'regular-rb-0',
          playerId: 'p3',
          playerName: 'Christian McCaffrey',
          playerTeam: 'SF',
          playerPosition: 'RB',
          pricePaid: 56.5,
        },
      ],
    }
    localStorage.setItem(SAVED_ROSTERS_KEY, JSON.stringify([saved]))
  }

  it('resuming with nothing in progress applies immediately, no confirm dialog', async () => {
    seedSavedRoster()
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Saved Rosters' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // The Roster landmark itself appears as soon as the player pool first
    // loads — hydrating the saved assignments into it is a second,
    // effect-triggered re-render straight after (see Draft.tsx's resume
    // effect), so this needs its own wait rather than a bare synchronous
    // assertion right after the roster first appears — same reasoning as
    // the sessionStorage-prune test elsewhere in this file.
    const roster = await screen.findByLabelText('Roster')
    await waitFor(() => {
      expect(roster).toHaveTextContent('Christian McCaffrey')
    })
  })

  it('resuming over an in-progress draft opens a ConfirmDialog; Cancel leaves the draft untouched', async () => {
    seedSavedRoster()
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Bijan Robinson'))

    fireEvent.click(screen.getByRole('button', { name: 'Saved Rosters' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }))

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent(
      'Resuming this saved roster will discard your current in-progress draft.',
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // Still on Saved Rosters — navigation to Draft never happened.
    expect(screen.getByRole('heading', { name: 'Saved Rosters' })).toBeInTheDocument()
  })

  it('confirming discards the in-progress draft and hydrates the saved roster', async () => {
    seedSavedRoster()
    await goToDraftPage()
    fireEvent.click(screen.getByLabelText('Draft Bijan Robinson'))

    fireEvent.click(screen.getByRole('button', { name: 'Saved Rosters' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }))

    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    const roster = await screen.findByLabelText('Roster')
    await waitFor(() => {
      expect(roster).toHaveTextContent('Christian McCaffrey')
    })
    expect(roster).not.toHaveTextContent('Bijan Robinson')
  })
})
