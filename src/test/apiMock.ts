// Fetch stubs for the web test project, which must stay fast and isolated —
// it does not require the Express server or Postgres to be running (that's
// what the separate `server` test project is for, see vite.config.ts).
//
// Payloads are built from src/data/*.ts, which is also what server/seed
// loads into Postgres — so the fixtures the components are tested against
// and the rows the real API serves come from the same source.

import { vi } from 'vitest'

import { leagueFormats, rosterPositionSlots } from '../data/leagueFormats'
import { players, playerValuations } from '../data/mockPlayers'
import type { LeagueFormatWithSlots } from '../types/League'
import type { PlayerWithValuations } from '../types/Player'

// The joins the API performs server-side.
export const playersPayload: PlayerWithValuations[] = players.map((player) => ({
  ...player,
  valuations: playerValuations.filter((valuation) => valuation.playerId === player.id),
}))

export const leagueFormatsPayload: LeagueFormatWithSlots[] = leagueFormats.map((format) => ({
  ...format,
  slots: rosterPositionSlots.filter((slot) => slot.leagueFormatId === format.id),
}))

// A minimal stand-in for Response — only .ok, .status and .json() are used
// by services/apiClient.ts.
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

/** Happy path: both endpoints resolve with the seeded fixture data. */
export function mockApi(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/players')) return jsonResponse(playersPayload)
      if (url.endsWith('/api/league-formats')) return jsonResponse(leagueFormatsPayload)
      return jsonResponse({ error: 'not_found', message: `No mock registered for ${url}` }, 404)
    }),
  )
}

/**
 * Every request resolves non-2xx with the API's real error body shape —
 * defaults mirror the 503 the server actually returns when Postgres is down.
 */
export function mockApiErrorResponse(
  status = 503,
  message = 'Cannot reach the database (ECONNREFUSED). Is the Postgres container running? Try: docker compose up -d',
): void {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'database_unavailable', message }, status)))
}

/** Non-2xx whose JSON body carries no `message` field to surface. */
export function mockApiMessagelessError(status = 502): void {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse('not an object', status)))
}

/** Non-2xx whose body isn't JSON at all (an HTML error page, say). */
export function mockApiNonJsonError(status = 502): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        ({
          ok: false,
          status,
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON')
          },
        }) as unknown as Response,
    ),
  )
}

/** The request itself fails — server not running, connection refused. */
export function mockApiNetworkFailure(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }),
  )
}

/** Never resolves — for asserting a loading state that stays put. */
export function mockApiNeverResolves(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )
}
