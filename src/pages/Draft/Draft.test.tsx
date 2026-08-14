// Loading and error states for the Draft page's player load. Fetch is
// stubbed — no Express server, no Postgres.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Draft from './Draft'
import { mockApi, mockApiErrorResponse, mockApiNetworkFailure, mockApiNeverResolves } from '../../test/apiMock'
import type { UseRosterResult } from '../../hooks/useRoster'
import type { UseFavoritesResult } from '../../hooks/useFavorites'
import type { UseSavedRostersResult } from '../../hooks/useSavedRosters'

const roster: UseRosterResult = {
  assignments: [],
  spent: 0,
  remaining: 200,
  isPlayerDrafted: () => false,
  draftPlayer: () => ({ ok: false, reason: 'no_eligible_slot' }),
  undraftPlayer: () => {},
  updatePrice: () => {},
  clearRoster: () => {},
  pruneUnknownPlayers: () => {},
  loadFromSavedRoster: () => {},
}

const favorites: UseFavoritesResult = {
  favoriteIds: [],
  isFavorited: () => false,
  toggleFavorite: () => {},
}

const savedRosters: UseSavedRostersResult = {
  savedRosters: [],
  isAtCap: false,
  saveNew: () => {},
  overwrite: () => {},
  deleteSavedRoster: () => {},
}

function renderDraft() {
  return render(
    <Draft
      slots={[]}
      toggles={{ kickerEnabled: true, defenseEnabled: true }}
      budget={200}
      leagueFormatKey="regular"
      formats={[]}
      roster={roster}
      favorites={favorites}
      savedRosters={savedRosters}
      pendingResume={null}
      onResumeHydrated={() => {}}
      onViewSavedRosters={() => {}}
      onGoToSetup={() => {}}
    />,
  )
}

describe('Draft page data states', () => {
  it('shows a loading state while the player load is in flight', () => {
    mockApiNeverResolves()
    renderDraft()

    expect(screen.getByRole('status')).toHaveTextContent('Loading players')
    expect(screen.queryByLabelText('Player pool')).not.toBeInTheDocument()
  })

  it('replaces loading with the player pool once the load resolves', async () => {
    mockApi()
    renderDraft()

    expect(screen.getByRole('status')).toHaveTextContent('Loading players')

    expect(await screen.findByLabelText('Player pool')).toBeInTheDocument()
    expect(screen.getByLabelText('Draft Christian McCaffrey')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an actionable error when the API returns a non-2xx response', async () => {
    mockApiErrorResponse()
    renderDraft()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load players (HTTP 503)')
    // The API's own hint reaches the user rather than a blank screen.
    expect(alert).toHaveTextContent('docker compose up -d')
    expect(screen.queryByLabelText('Player pool')).not.toBeInTheDocument()
  })

  it('shows an actionable error when the request itself fails', async () => {
    mockApiNetworkFailure()
    renderDraft()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('the API did not respond')
    expect(alert).toHaveTextContent('npm run dev:server')
  })

  it('keeps the page heading visible in every state, so the screen is never blank', async () => {
    mockApiErrorResponse()
    renderDraft()

    expect(screen.getByText('Draft')).toBeInTheDocument()
    await screen.findByRole('alert')
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })
})
