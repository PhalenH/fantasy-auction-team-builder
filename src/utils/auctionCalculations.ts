// Combined auction value is derived, never stored (see docs/datamodel.md:
// PlayerValuation). This function is intentionally source-agnostic — it
// just averages whatever auctionValue entries it's given, so adding a
// third/fourth ValuationSource later needs no change here.

import type { PlayerValuation } from '../types/Player'

// Returns null (not 0/NaN) when there's no valuation data, so callers can
// render "—" instead of a misleading $0 value.
export function getCombinedAuctionValue(
  valuations: PlayerValuation[],
): number | null {
  if (valuations.length === 0) return null

  const total = valuations.reduce((sum, v) => sum + v.auctionValue, 0)
  const mean = total / valuations.length

  // Round to cents to avoid floating-point noise (e.g. averaging 3 values).
  return Math.round(mean * 100) / 100
}
