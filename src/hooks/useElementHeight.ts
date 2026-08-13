// Tracks a DOM element's rendered height via ResizeObserver, re-rendering
// whenever it changes.
//
// Exists for Draft.tsx's Players/Roster height-matching: CSS alone can't
// express "match a sibling's natural content height while independently
// scrolling" when nothing in the page has a definite (non-auto/min-height)
// height — flex-grow/grid stretch only work relative to an already-definite
// container size, and this page's height is intentionally content-driven
// (a normal scrolling page), not viewport-locked. Measuring the Roster
// column's actual rendered height here is what supplies that missing
// definite number.
//
// Returns a callback ref, not a plain useRef object, and that's load-
// bearing here specifically: Draft.tsx's roster column only mounts once its
// async player load resolves (an early `status !== 'ready'` return renders
// something else first), so the target node doesn't exist yet when this
// hook itself first mounts. A useRef object never changes identity when
// its .current is later attached, so an effect keyed on it would only ever
// run once, while .current was still null, and never observe anything. A
// callback ref instead fires exactly when React attaches (or detaches) the
// node, whenever that happens to be.
import { useCallback, useRef, useState } from 'react'

export function useElementHeight<T extends HTMLElement>(): [(node: T | null) => void, number | undefined] {
  const [height, setHeight] = useState<number | undefined>(undefined)
  const observerRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null

    if (!node) {
      setHeight(undefined)
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height)
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  return [ref, height]
}
