// The two failure modes the mock-data services never had: a request that
// fails outright, and a response that isn't 2xx. Both must produce an error
// carrying something actionable — never a silently-parsed error body.

import { describe, expect, it } from 'vitest'
import { fetchJson } from './apiClient'
import {
  mockApi,
  mockApiErrorResponse,
  mockApiMessagelessError,
  mockApiNetworkFailure,
  mockApiNonJsonError,
} from '../test/apiMock'

describe('fetchJson', () => {
  it('returns the parsed body on a 2xx response', async () => {
    mockApi()
    await expect(fetchJson('/api/players', 'players')).resolves.toBeInstanceOf(Array)
  })

  it('surfaces the API’s own message on a non-2xx response', async () => {
    mockApiErrorResponse()

    // The 503 body's message names the container and the fix — far more
    // useful than a generic "request failed", so it must reach the UI.
    await expect(fetchJson('/api/players', 'players')).rejects.toThrow(
      /Could not load players \(HTTP 503\): Cannot reach the database/,
    )
    await expect(fetchJson('/api/players', 'players')).rejects.toThrow(/docker compose up -d/)
  })

  it('does not parse a non-2xx body as if it were the success shape', async () => {
    // The error body is an object, so a naive .json() would resolve it as
    // data and hand the UI something that isn't a player array at all.
    mockApiErrorResponse(500, 'boom')
    await expect(fetchJson('/api/players', 'players')).rejects.toThrow()
  })

  it('falls back to a server hint when the error body has no message', async () => {
    mockApiMessagelessError()
    await expect(fetchJson('/api/players', 'players')).rejects.toThrow(
      /Could not load players \(HTTP 502\)\. Is the API server running\?/,
    )
  })

  it('survives a non-JSON error body instead of throwing a parse error', async () => {
    mockApiNonJsonError()
    // The status-based message must still come through — not the SyntaxError.
    await expect(fetchJson('/api/players', 'players')).rejects.toThrow(/HTTP 502/)
  })

  it('explains that the API did not respond when the request itself fails', async () => {
    mockApiNetworkFailure()
    await expect(fetchJson('/api/players', 'players')).rejects.toThrow(
      /the API did not respond\. Is the API server running\? Start it with: npm run dev:server/,
    )
  })

  it('names the resource that failed, so the message is specific', async () => {
    mockApiNetworkFailure()
    await expect(fetchJson('/api/league-formats', 'league formats')).rejects.toThrow(
      /Could not load league formats/,
    )
  })
})
