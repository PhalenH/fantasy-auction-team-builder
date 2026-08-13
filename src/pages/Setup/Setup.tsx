// Choose league format, kicker/defense toggles, and budget, then hand off
// to the Draft page. Budget presets are UI-only constants here, per
// docs/datamodel.md's "Budget presets" section — not modeled data.

import LeagueSelector from '../../components/LeagueSelector/LeagueSelector'
import NewsTicker from '../../components/NewsTicker/NewsTicker'
import type { LeagueFormatWithSlots } from '../../types/League'
import type { UseDraftSessionResult } from '../../hooks/useDraftSession'

const BUDGET_PRESETS = [150, 200, 250, 300]

interface SetupProps {
  formats: LeagueFormatWithSlots[]
  draftSession: UseDraftSessionResult
  onStartDraft: () => void
}

function Setup({ formats, draftSession, onStartDraft }: SetupProps) {
  const {
    leagueFormatId,
    setLeagueFormatId,
    budget,
    setBudget,
    kickerEnabled,
    setKickerEnabled,
    defenseEnabled,
    setDefenseEnabled,
  } = draftSession

  const canStart = leagueFormatId !== null && budget !== null && budget > 0
  const isCustomBudget = budget !== null && !BUDGET_PRESETS.includes(budget)

  return (
    // flex-col so the ticker sits above the card in normal document flow
    // (not sticky/fixed) as its own full-width strip, rather than beside it
    // in the same row — the card-centering flex/padding that used to live
    // on this outer div moved to the inner wrapper below so the ticker
    // itself can span edge-to-edge with no page padding.
    <div className="flex min-h-screen w-full flex-col bg-page-dark">
      <NewsTicker />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-center text-2xl font-bold text-slate-900">Set Up Your Draft</h1>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">League Format</h2>
            <LeagueSelector
              formats={formats}
              selectedFormatId={leagueFormatId}
              onSelect={setLeagueFormatId}
            />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Roster Extras</h2>
            <label className="mr-4 inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={kickerEnabled}
                onChange={(event) => setKickerEnabled(event.target.checked)}
                className="accent-accent-green"
              />
              Kicker
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={defenseEnabled}
                onChange={(event) => setDefenseEnabled(event.target.checked)}
                className="accent-accent-green"
              />
              Defense/Special Teams
            </label>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Auction Budget</h2>
            <div className="flex flex-wrap items-center gap-2">
              {BUDGET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBudget(preset)}
                  aria-pressed={budget === preset}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    budget === preset
                      ? 'border-accent-green bg-accent-green text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  ${preset}
                </button>
              ))}
              <input
                type="number"
                min={1}
                placeholder="Custom"
                value={isCustomBudget ? budget : ''}
                onChange={(event) =>
                  setBudget(event.target.value === '' ? null : Number(event.target.value))
                }
                className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                aria-label="Custom budget amount"
              />
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              disabled={!canStart}
              onClick={onStartDraft}
              className="rounded-md bg-accent-green px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Setup
