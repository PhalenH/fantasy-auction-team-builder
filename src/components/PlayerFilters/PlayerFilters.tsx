// Position filter only. K/DST are hidden from the pool entirely upstream
// (Draft page, per docs/datamodel.md's "UI-layer filter on the existing
// Position field") — this component just renders whatever positions are
// actually present in the players it's given, so a toggled-off position
// never appears here without any toggle logic being duplicated.

import type { PositionCode } from '../../types/Player'

interface PlayerFiltersProps {
  positions: PositionCode[]
  selectedPosition: PositionCode | 'ALL'
  onSelectPosition: (position: PositionCode | 'ALL') => void
}

function PlayerFilters({ positions, selectedPosition, onSelectPosition }: PlayerFiltersProps) {
  const options: Array<PositionCode | 'ALL'> = ['ALL', ...positions]

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
