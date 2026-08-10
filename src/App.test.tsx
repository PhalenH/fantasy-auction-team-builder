// Integration-style tests over the real component tree (App -> Setup ->
// Draft), using the real services and the real hooks/utils pipeline — this
// exercises the actual CLAUDE.md Core User Flow, not a stubbed
// approximation of it.
//
// Only the network boundary is stubbed: the services now call fetch, so
// mockApi() serves the same src/data fixtures the API itself is seeded
// from. That keeps this project fast and independent of the Express server
// and Postgres (the `server` test project covers the live round trip).

import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import App from './App'
import { mockApi, mockApiErrorResponse, mockApiNetworkFailure, mockApiNeverResolves } from './test/apiMock'

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

    expect(await screen.findByText('Draft')).toBeInTheDocument()
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
})
