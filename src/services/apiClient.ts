// Shared transport for the read-only Express API. Both services go through
// this, so the two things the mock-data version never had to handle — a
// request that fails outright, and a response that isn't 2xx — are handled
// in exactly one place.
//
// Paths are relative (/api/...), never absolute: in dev the Vite proxy
// forwards /api to the Express port (see vite.config.ts), so the browser
// only ever makes same-origin requests and there's no host or port
// hardcoded anywhere in the frontend.

const SERVER_HINT = 'Is the API server running? Start it with: npm run dev:server'

// The API's own error responses are { error, message } — its message is the
// most useful thing we can show (e.g. the 503 database_unavailable one names
// the container and the command to start it), so surface it rather than
// inventing a generic string.
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body !== null && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      return body.message
    }
  } catch {
    // Non-JSON error body (an HTML error page, an empty response) — fall
    // through to the status-only message.
  }
  return ''
}

export async function fetchJson<T>(path: string, resource: string): Promise<T> {
  let response: Response

  try {
    response = await fetch(path)
  } catch (cause) {
    // Server down, DNS failure, connection refused — fetch rejects before
    // there is any response to inspect.
    throw new Error(`Could not load ${resource}: the API did not respond. ${SERVER_HINT}`, { cause })
  }

  // Guard before parsing: a non-2xx body is the API's error shape, not the
  // success shape, and parsing it as the latter would hand the UI a bad
  // object instead of an error.
  if (!response.ok) {
    const detail = await readErrorMessage(response)
    throw new Error(
      `Could not load ${resource} (HTTP ${response.status})` + (detail ? `: ${detail}` : `. ${SERVER_HINT}`),
    )
  }

  return (await response.json()) as T
}
