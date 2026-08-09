// Compact inline summary — Total / Spent / Remaining, per CLAUDE.md's
// Budget Tracking example — meant to sit next to the Roster section
// heading rather than as a standalone full-width card. Remaining is never
// clamped upstream (see budgetCalculations.ts): red on overspend, green
// otherwise (zero counts as the normal, non-overspent state).

interface BudgetDisplayProps {
  budget: number
  spent: number
  remaining: number
}

function BudgetDisplay({ budget, spent, remaining }: BudgetDisplayProps) {
  const remainingColor = remaining < 0 ? 'text-red-600' : 'text-green-600'

  return (
    <div aria-label="Budget" className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
      <span>
        Budget <span className="font-semibold text-slate-900">${budget.toFixed(2)}</span>
      </span>
      <span>
        Spent <span className="font-semibold text-slate-900">${spent.toFixed(2)}</span>
      </span>
      <span>
        Remaining <span className={`font-semibold ${remainingColor}`}>${remaining.toFixed(2)}</span>
      </span>
    </div>
  )
}

export default BudgetDisplay
