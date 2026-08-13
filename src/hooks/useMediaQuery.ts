// Whether a CSS media query currently matches, kept in sync with the
// browser as the viewport crosses the breakpoint. Generic/reusable — the
// first consumer is Draft.tsx's height-matching (see useElementHeight),
// which needs a JS-side view of the same lg: breakpoint Tailwind uses, to
// decide whether to apply a measured height at all.

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query)
    const onChange = () => setMatches(mediaQueryList.matches)

    // Re-sync here too: useState's lazy initializer only runs once on
    // mount, so if `query` itself changes on a later render this effect
    // re-running is what picks up the new query's current match state —
    // matchMedia's "change" event only fires on a future crossing, not for
    // the query's state at the moment it's created.
    onChange()
    mediaQueryList.addEventListener('change', onChange)
    return () => mediaQueryList.removeEventListener('change', onChange)
  }, [query])

  return matches
}
