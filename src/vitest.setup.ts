import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Explicit cleanup since test.globals isn't enabled — without this, DOM
// trees from prior tests in the same file would still be mounted when the
// next test renders, causing duplicate-match query errors.
afterEach(() => {
  cleanup()
  // Drops any fetch stub a test installed, so stubs never leak between files.
  vi.unstubAllGlobals()
})

// Now that the services call fetch, an un-stubbed test would otherwise make a
// real network request — slow, and dependent on the API actually running.
// This makes that a loud failure instead: tests that need data call one of
// the helpers in src/test/apiMock.ts.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error(
        'Unmocked fetch in a web test. Call mockApi() (or another helper from src/test/apiMock.ts) first.',
      )
    }),
  )
})
