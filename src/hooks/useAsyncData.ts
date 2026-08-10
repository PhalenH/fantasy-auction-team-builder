// Tracks an async service call's lifecycle so pages can show a loading and
// an error state instead of a blank screen.
//
// Needed because the services now hit a real API: over mock data they could
// never fail, so the pages just did `.then(setState)` with no failure path.
//
// Kept generic and in hooks/ (rather than duplicated in App and Draft)
// because both pages need exactly this — CLAUDE.md: prefer small, reusable
// pieces, and keep shared state handling in hooks/.

import { useEffect, useState } from 'react'

export type AsyncStatus = 'loading' | 'ready' | 'error'

export interface AsyncDataResult<T> {
  data: T | null
  status: AsyncStatus
  error: string | null
}

/**
 * `load` must be a stable reference (a module-level service function, or one
 * wrapped in useCallback) — it's the effect's dependency, so a new function
 * identity on every render would re-fetch in a loop.
 */
export function useAsyncData<T>(load: () => Promise<T>): AsyncDataResult<T> {
  const [result, setResult] = useState<AsyncDataResult<T>>({
    data: null,
    status: 'loading',
    error: null,
  })

  useEffect(() => {
    // Guards against setting state after unmount, and against an earlier
    // slow response overwriting a later one if `load` changes mid-flight.
    let cancelled = false

    setResult({ data: null, status: 'loading', error: null })

    load()
      .then((data) => {
        if (!cancelled) setResult({ data, status: 'ready', error: null })
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setResult({
          data: null,
          status: 'error',
          // The services compose messages that already carry an actionable
          // hint, so the page can render this text directly.
          error: cause instanceof Error ? cause.message : String(cause),
        })
      })

    return () => {
      cancelled = true
    }
  }, [load])

  return result
}
