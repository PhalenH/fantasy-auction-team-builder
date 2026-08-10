// Renders the loading and error states for a useAsyncData call. Returns null
// once the data is ready, so a page can render it unconditionally above its
// content or return it early in place of that content.
//
// Deliberately minimal — no retry button, no offline handling. The point is
// that a failed load says so, with something actionable, instead of leaving
// a blank screen and an unhandled rejection in the console.

import type { AsyncStatus } from '../../hooks/useAsyncData'

interface DataStatusProps {
  status: AsyncStatus
  /** e.g. "Loading players…" */
  loadingLabel: string
  /** The service's error message, which already includes a hint. */
  error: string | null
}

function DataStatus({ status, loadingLabel, error }: DataStatusProps) {
  if (status === 'loading') {
    return (
      <p role="status" className="text-sm text-slate-500">
        {loadingLabel}
      </p>
    )
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        <p className="font-semibold">Couldn’t load data</p>
        <p className="mt-1">{error}</p>
      </div>
    )
  }

  return null
}

export default DataStatus
