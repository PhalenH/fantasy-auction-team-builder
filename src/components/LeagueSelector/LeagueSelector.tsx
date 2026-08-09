import type { LeagueFormatKey, LeagueFormatWithSlots } from '../../types/League'

interface LeagueSelectorProps {
  formats: LeagueFormatWithSlots[]
  selectedFormatId: LeagueFormatKey | null
  onSelect: (formatId: LeagueFormatKey) => void
}

function LeagueSelector({ formats, selectedFormatId, onSelect }: LeagueSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="League format">
      {formats.map((format) => (
        <button
          key={format.id}
          type="button"
          onClick={() => onSelect(format.key)}
          aria-pressed={selectedFormatId === format.key}
          className={`rounded-md border px-4 py-2 text-sm font-medium ${
            selectedFormatId === format.key
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
          }`}
        >
          {format.displayName}
        </button>
      ))}
    </div>
  )
}

export default LeagueSelector
