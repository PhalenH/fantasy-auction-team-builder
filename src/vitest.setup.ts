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

// jsdom's sessionStorage is a real, shared implementation that otherwise
// persists across every test in a file (only a fresh test *file* gets a
// fresh jsdom). Now that useDraftSession/useRoster/useFavorites all write
// to it, a prior test's draft session would silently rehydrate into the
// next test's <App /> and skip Setup unless cleared here.
beforeEach(() => {
  sessionStorage.clear()
})

// jsdom implements neither at all (not "implements with different
// behavior" — the globals are simply undefined), which crashes any
// component using them: Draft.tsx's height-matching (useMediaQuery,
// useElementHeight) needs both. jsdom also doesn't perform real layout
// (getBoundingClientRect/contentRect are always 0 regardless), so there is
// no real viewport for matchMedia to evaluate against — reporting no match
// is the correct behavior here, not a workaround: it exercises the
// narrow-layout fallback path, which is the only one jsdom could honestly
// claim anyway.
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )

  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
