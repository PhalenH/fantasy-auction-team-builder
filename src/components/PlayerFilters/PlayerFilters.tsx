// Position filter, rendered in a fixed canonical order (ALL, QB, RB, WR,
// TE, FLEX, K, DST) rather than whatever incidental order positions happen
// to appear in the player list. FLEX is included whenever flexEligible is
// true — derived upstream from the active format's RosterPositionSlot
// config (see utils/rosterAssignment.ts's getFlexEligiblePositions), not
// hardcoded here. K/DST are hidden from the pool entirely upstream
// (Draft page, per docs/datamodel.md's "UI-layer filter on the existing
// Position field") — this component only shows them when actually present
// in the supplied `positions`, so a toggled-off position never appears here
// without any toggle logic being duplicated.

import type { PositionCode } from '../../types/Player'

const CANONICAL_POSITION_ORDER: Array<PositionCode | 'FLEX'> = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DST']

interface PlayerFiltersProps {
  positions: PositionCode[]
  flexEligible: boolean
  selectedPosition: PositionCode | 'ALL' | 'FLEX'
  onSelectPosition: (position: PositionCode | 'ALL' | 'FLEX') => void
}

function PlayerFilters({ positions, flexEligible, selectedPosition, onSelectPosition }: PlayerFiltersProps) {
  const presentPositions = new Set(positions)
  const options: Array<PositionCode | 'ALL' | 'FLEX'> = [
    'ALL',
    ...CANONICAL_POSITION_ORDER.filter((token) => (token === 'FLEX' ? flexEligible : presentPositions.has(token))),
  ]

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter players by position">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelectPosition(option)}
          aria-pressed={selectedPosition === option}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            selectedPosition === option
              ? 'border-accent-green bg-accent-green text-white'
              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export default PlayerFilters
