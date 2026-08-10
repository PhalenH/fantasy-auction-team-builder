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

  // Remaining always renders on its own row below Budget/Spent — not via
  // flex-wrap, which used to reflow only once a longer negative value made
  // the row too wide to fit. That meant the layout looked different
  // depending on the numbers. Two explicit rows every time means the
  // structure never depends on value length.
  return (
    <div aria-label="Budget" className="text-xs text-slate-500">
      <div className="flex gap-x-3">
        <span>
          Budget <span className="font-semibold text-slate-900">${budget.toFixed(2)}</span>
        </span>
        <span>
          Spent <span className="font-semibold text-slate-900">${spent.toFixed(2)}</span>
        </span>
      </div>
      <div>
        Remaining <span className={`font-semibold ${remainingColor}`}>${remaining.toFixed(2)}</span>
      </div>
    </div>
  )
}

export default BudgetDisplay
