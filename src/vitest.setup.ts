import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Explicit cleanup since test.globals isn't enabled — without this, DOM
// trees from prior tests in the same file would still be mounted when the
// next test renders, causing duplicate-match query errors.
afterEach(() => {
  cleanup()
})
