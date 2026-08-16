// A rejected draftPlayer() call is scoped here with a fake onDraft rather
// than driven through the full App, so each of the three documented
// reasons can be checked in isolation without manufacturing the exact
// roster state each one requires. A real, end-to-end no_open_capacity
// rejection (real clicks, real validateAssignment, no mocking) is also
// covered separately in App.test.tsx, now that data/mockPlayers.ts seeds
// enough RBs to exhaust RB-eligible capacity through the running app.
// This file still exercises the real PlayerList + PlayerRow wiring:
// onDraft returning a rejection, mapped through the real
// ASSIGNMENT_REJECTION_MESSAGES table, must show a message and must not
// mark the player as drafted or throw.

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import PlayerList from './PlayerList'
import type { PlayerWithValuations } from '../../types/Player'

const player: PlayerWithValuations = {
  id: 'p1',
  name: 'Test Player',
  teamCode: 'TST',
  teamDisplayName: 'Test Team',
  position: 'RB',
  byeWeek: 1,
  valuations: [
    { id: 'v1', playerId: 'p1', source: 'espn', auctionValue: 10, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
  ],
}

describe('PlayerList position filtering', () => {
  const multiPositionPlayers: PlayerWithValuations[] = [
    { ...player, id: 'rb1', name: 'Test RB', position: 'RB' },
    { ...player, id: 'wr1', name: 'Test WR', position: 'WR' },
    { ...player, id: 'qb1', name: 'Test QB', position: 'QB' },
  ]

  it('shows every player under "ALL" and narrows to one position on selection', () => {
    render(
      <PlayerList
        players={multiPositionPlayers}
        flexEligiblePositions={[]}
        isPlayerDrafted={() => false}
        isFavorited={() => false}
        onDraft={() => ({ ok: true, assignment: { slotInstanceId: 's-0', playerId: 'x', pricePaid: 1 } })}
        onToggleFavorite={() => {}}
        onClearRoster={() => {}}
      />,
    )

    // Default is "ALL" — every position present.
    expect(screen.getByText('Test RB')).toBeInTheDocument()
    expect(screen.getByText('Test WR')).toBeInTheDocument()
    expect(screen.getByText('Test QB')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'RB' }))
    expect(screen.getByText('Test RB')).toBeInTheDocument()
    expect(screen.queryByText('Test WR')).not.toBeInTheDocument()
    expect(screen.queryByText('Test QB')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ALL' }))
    expect(screen.getByText('Test RB')).toBeInTheDocument()
    expect(screen.getByText('Test WR')).toBeInTheDocument()
    expect(screen.getByText('Test QB')).toBeInTheDocument()
  })
})

describe('PlayerList FLEX filter', () => {
  const players: PlayerWithValuations[] = [
    { ...player, id: 'qb1', name: 'Test QB', position: 'QB' },
    { ...player, id: 'rb1', name: 'Test RB', position: 'RB' },
    { ...player, id: 'wr1', name: 'Test WR', position: 'WR' },
    { ...player, id: 'te1', name: 'Test TE', position: 'TE' },
  ]

  function renderList(flexEligiblePositions: PlayerWithValuations['position'][]) {
    return render(
      <PlayerList
        players={players}
        flexEligiblePositions={flexEligiblePositions}
        isPlayerDrafted={() => false}
        isFavorited={() => false}
        onDraft={() => ({ ok: true, assignment: { slotInstanceId: 's-0', playerId: 'x', pricePaid: 1 } })}
        onToggleFavorite={() => {}}
        onClearRoster={() => {}}
      />,
    )
  }

  it('does not show a FLEX button when the format has no FLEX-eligible positions', () => {
    renderList([])
    expect(screen.queryByRole('button', { name: 'FLEX' })).not.toBeInTheDocument()
  })

  it('shows a FLEX button and filters to the given eligible positions when the format has one', () => {
    renderList(['RB', 'WR', 'TE'])
    expect(screen.getByRole('button', { name: 'FLEX' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'FLEX' }))
    expect(screen.getByText('Test RB')).toBeInTheDocument()
    expect(screen.getByText('Test WR')).toBeInTheDocument()
    expect(screen.getByText('Test TE')).toBeInTheDocument()
    // QB is not part of this format's FLEX eligibility, so it's excluded —
    // this couldn't be right if the filter matched on player.position
    // === 'FLEX' (which would never match anything at all), confirming it
    // really is filtering via flexEligiblePositions.
    expect(screen.queryByText('Test QB')).not.toBeInTheDocument()
  })

  it('only includes positions actually eligible for this format\'s FLEX slot, not every non-QB position', () => {
    // A narrower FLEX (RB/WR only, no TE) — TE must be excluded too, not
    // just QB, confirming the filter isn't secretly "everything but QB".
    renderList(['RB', 'WR'])
    fireEvent.click(screen.getByRole('button', { name: 'FLEX' }))
    expect(screen.getByText('Test RB')).toBeInTheDocument()
    expect(screen.getByText('Test WR')).toBeInTheDocument()
    expect(screen.queryByText('Test TE')).not.toBeInTheDocument()
  })

  it('renders filter buttons in canonical order: ALL, QB, RB, WR, TE, FLEX', () => {
    renderList(['RB', 'WR', 'TE'])
    const buttons = screen.getAllByRole('button', { name: /^(ALL|QB|RB|WR|TE|FLEX|K|DST)$/ })
    expect(buttons.map((b) => b.textContent)).toEqual(['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX'])
  })
})

describe('PlayerList sorting', () => {
  function valuationFor(playerId: string, auctionValue: number) {
    return [
      { id: `${playerId}-v`, playerId, source: 'espn' as const, auctionValue, seasonYear: 2026, updatedAt: '2026-08-01T00:00:00Z' },
    ]
  }

  // Deliberately supplied out of value order, and mixing positions, so a
  // passing test can't be explained by input order or by filtering alone.
  const mixedPlayers: PlayerWithValuations[] = [
    { ...player, id: 'rb-mid', name: 'RB Mid', position: 'RB', valuations: valuationFor('rb-mid', 20) },
    { ...player, id: 'wr-high', name: 'WR High', position: 'WR', valuations: valuationFor('wr-high', 50) },
    { ...player, id: 'rb-low', name: 'RB Low', position: 'RB', valuations: valuationFor('rb-low', 5) },
    { ...player, id: 'rb-high', name: 'RB High', position: 'RB', valuations: valuationFor('rb-high', 40) },
  ]

  function dataRowNames() {
    // Row 0 is the header; data rows follow in DOM/render order.
    const rows = screen.getAllByRole('row').slice(1)
    return rows.map((row) => within(row).getByRole('button', { name: /already drafted|^Draft / }).textContent)
  }

  it('renders players sorted by combined value descending by default', () => {
    render(
      <PlayerList
        players={mixedPlayers}
        flexEligiblePositions={[]}
        isPlayerDrafted={() => false}
        isFavorited={() => false}
        onDraft={() => ({ ok: true, assignment: { slotInstanceId: 's-0', playerId: 'x', pricePaid: 1 } })}
        onToggleFavorite={() => {}}
        onClearRoster={() => {}}
      />,
    )

    expect(dataRowNames()).toEqual(['WR High', 'RB High', 'RB Mid', 'RB Low'])
  })

  it('keeps descending combined-value order within a position filter', () => {
    render(
      <PlayerList
        players={mixedPlayers}
        flexEligiblePositions={[]}
        isPlayerDrafted={() => false}
        isFavorited={() => false}
        onDraft={() => ({ ok: true, assignment: { slotInstanceId: 's-0', playerId: 'x', pricePaid: 1 } })}
        onToggleFavorite={() => {}}
        onClearRoster={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'RB' }))

    // WR High is filtered out; the remaining RBs must still be descending.
    expect(dataRowNames()).toEqual(['RB High', 'RB Mid', 'RB Low'])
  })
})

describe('PlayerList table layout', () => {
  it('renders a table with the required columns and one row per player', () => {
    render(
      <PlayerList
        players={[player]}
        flexEligiblePositions={[]}
        isPlayerDrafted={() => false}
        isFavorited={() => false}
        onDraft={() => ({ ok: true, assignment: { slotInstanceId: 's-0', playerId: 'x', pricePaid: 1 } })}
        onToggleFavorite={() => {}}
        onClearRoster={() => {}}
      />,
    )

    const table = screen.getByRole('table')
    for (const columnName of ['Player', 'POS', 'Team', 'Bye', 'Yahoo', 'ESPN', 'Avg']) {
      expect(screen.getByRole('columnheader', { name: columnName })).toBeInTheDocument()
    }

    const row = screen.getByRole('row', { name: /Test Player/ })
    expect(table).toContainElement(row)
    expect(row).toHaveTextContent('RB')
    expect(row).toHaveTextContent('TST')
    const cells = within(row).getAllByRole('cell')
    expect(cells[3]).toHaveTextContent('1') // Bye
    expect(cells[6]).toHaveTextContent('$10.00') // Avg — only an espn valuation, so combined equals it
  })
})

describe('PlayerList rejection handling', () => {
  it('shows the mapped message and leaves the player undrafted when onDraft rejects', () => {
    const onDraft = vi.fn().mockReturnValue({ ok: false, reason: 'no_open_capacity' })

    render(
      <PlayerList
        players={[player]}
        flexEligiblePositions={[]}
        isPlayerDrafted={() => false}
        isFavorited={() => false}
        onDraft={onDraft}
        onToggleFavorite={() => {}}
        onClearRoster={() => {}}
      />,
    )

    expect(() => fireEvent.click(screen.getByLabelText('Draft Test Player'))).not.toThrow()

    expect(onDraft).toHaveBeenCalledWith(player)
    expect(screen.getByRole('alert')).toHaveTextContent('Your roster is full for this position.')
    expect(screen.getByLabelText('Draft Test Player')).not.toBeDisabled()
  })

  it('maps each documented rejection reason to its own plain-language message', () => {
    const reasons: Array<['already_assigned' | 'no_eligible_slot' | 'no_open_capacity', string]> = [
      ['already_assigned', 'This player is already on your roster.'],
      ['no_eligible_slot', 'No open slot for this position.'],
      ['no_open_capacity', 'Your roster is full for this position.'],
    ]

    for (const [reason, expectedMessage] of reasons) {
      const onDraft = vi.fn().mockReturnValue({ ok: false, reason })
      const { unmount } = render(
        <PlayerList
          players={[player]}
          flexEligiblePositions={[]}
          isPlayerDrafted={() => false}
          isFavorited={() => false}
          onDraft={onDraft}
          onToggleFavorite={() => {}}
          onClearRoster={() => {}}
        />,
      )

      fireEvent.click(screen.getByLabelText('Draft Test Player'))
      expect(screen.getByRole('alert')).toHaveTextContent(expectedMessage)
      unmount()
    }
  })

  it('clears the rejection message once a draft succeeds', () => {
    const onDraft = vi
      .fn()
      .mockReturnValueOnce({ ok: false, reason: 'no_open_capacity' })
      .mockReturnValueOnce({ ok: true, assignment: { slotInstanceId: 's-0', playerId: 'p1', pricePaid: 10 } })

    render(
      <PlayerList
        players={[player]}
        flexEligiblePositions={[]}
        isPlayerDrafted={() => false}
        isFavorited={() => false}
        onDraft={onDraft}
        onToggleFavorite={() => {}}
        onClearRoster={() => {}}
      />,
    )

    fireEvent.click(screen.getByLabelText('Draft Test Player'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Draft Test Player'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
