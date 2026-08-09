import type { PlayerWithValuations } from '../../types/Player'

interface RosterSlotProps {
  slotLabel: string
  player: PlayerWithValuations | null
  pricePaid: number | null
  onUndraft: (playerId: string) => void
}

function RosterSlot({ slotLabel, player, pricePaid, onUndraft }: RosterSlotProps) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1 text-sm">
      <span className="w-14 shrink-0 font-mono text-xs text-slate-500">{slotLabel}</span>
      {player ? (
        <button
          type="button"
          onClick={() => onUndraft(player.id)}
          aria-label={`Remove ${player.name} from roster`}
          className="flex-1 truncate text-left text-slate-900 hover:text-red-600 hover:underline"
        >
          {player.name}
        </button>
      ) : (
        <span className="flex-1 text-slate-400">Empty</span>
      )}
      {pricePaid !== null && (
        <span className="ml-2 font-medium text-slate-700">${pricePaid.toFixed(2)}</span>
      )}
    </div>
  )
}

export default RosterSlot
