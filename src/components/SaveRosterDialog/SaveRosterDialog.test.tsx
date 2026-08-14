import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SaveRosterDialog from './SaveRosterDialog'
import type { SavedRoster } from '../../types/Roster'
import type { LeagueFormatWithSlots } from '../../types/League'

const FORMATS: LeagueFormatWithSlots[] = [
  { id: 'regular', key: 'regular', displayName: 'Regular', slots: [] },
]

function savedRoster(overrides: Partial<SavedRoster> = {}): SavedRoster {
  return {
    id: 'save-1',
    name: 'My Draft',
    savedAt: '2026-08-01T00:00:00Z',
    leagueFormatKey: 'regular',
    budget: 200,
    defenseEnabled: true,
    kickerEnabled: true,
    totalSpent: 150,
    remainingBudget: 50,
    assignments: [],
    ...overrides,
  }
}

describe('SaveRosterDialog — new mode', () => {
  it('renders nothing when closed', () => {
    render(
      <SaveRosterDialog
        open={false}
        mode="new"
        existingRosters={[]}
        formats={FORMATS}
        onCancel={() => {}}
        onSave={() => {}}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('starts with an empty name field showing the placeholder, not a pre-filled default', () => {
    render(
      <SaveRosterDialog
        open
        mode="new"
        existingRosters={[]}
        formats={FORMATS}
        onCancel={() => {}}
        onSave={() => {}}
      />,
    )
    const input = screen.getByLabelText('Name') as HTMLInputElement
    expect(input.value).toBe('')
    expect(input).toHaveAttribute('placeholder', 'e.g. Draft 8/6 or Hero RB build')
  })

  it('Save is enabled even with a blank name, and passes the raw (empty) value through', () => {
    const onSave = vi.fn()
    render(
      <SaveRosterDialog
        open
        mode="new"
        existingRosters={[]}
        formats={FORMATS}
        onCancel={() => {}}
        onSave={onSave}
      />,
    )
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith('', null, false)
  })

  it('passes a typed name through untrimmed-processing (Draft.tsx trims/resolves it)', () => {
    const onSave = vi.fn()
    render(
      <SaveRosterDialog
        open
        mode="new"
        existingRosters={[]}
        formats={FORMATS}
        onCancel={() => {}}
        onSave={onSave}
      />,
    )
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Hero RB build' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith('Hero RB build', null, false)
  })

  it('"Save and clear current roster" calls onSave with clearAfterSave true', () => {
    const onSave = vi.fn()
    render(
      <SaveRosterDialog
        open
        mode="new"
        existingRosters={[]}
        formats={FORMATS}
        onCancel={() => {}}
        onSave={onSave}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save and clear current roster' }))
    expect(onSave).toHaveBeenCalledWith('', null, true)
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    render(
      <SaveRosterDialog
        open
        mode="new"
        existingRosters={[]}
        formats={FORMATS}
        onCancel={onCancel}
        onSave={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('resets the name field back to empty each time the dialog re-opens', () => {
    const { rerender } = render(
      <SaveRosterDialog
        open
        mode="new"
        existingRosters={[]}
        formats={FORMATS}
        onCancel={() => {}}
        onSave={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Some name' } })
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Some name')

    rerender(
      <SaveRosterDialog
        open={false}
        mode="new"
        existingRosters={[]}
        formats={FORMATS}
        onCancel={() => {}}
        onSave={() => {}}
      />,
    )
    rerender(
      <SaveRosterDialog
        open
        mode="new"
        existingRosters={[]}
        formats={FORMATS}
        onCancel={() => {}}
        onSave={() => {}}
      />,
    )
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('')
  })
})

describe('SaveRosterDialog — overwrite mode', () => {
  const existingRosters = [savedRoster({ id: 'a', name: 'Old Save A' }), savedRoster({ id: 'b', name: 'Old Save B' })]

  it('Save is disabled until an existing save is picked', () => {
    render(
      <SaveRosterDialog
        open
        mode="overwrite"
        existingRosters={existingRosters}
        formats={FORMATS}
        onCancel={() => {}}
        onSave={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save and clear current roster' })).toBeDisabled()
  })

  it('picking a save pre-fills the rename field with its existing name and enables Save', () => {
    render(
      <SaveRosterDialog
        open
        mode="overwrite"
        existingRosters={existingRosters}
        formats={FORMATS}
        onCancel={() => {}}
        onSave={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('Old Save A'))
    expect((screen.getByLabelText('Rename (optional)') as HTMLInputElement).value).toBe('Old Save A')
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
  })

  it('Save passes the picked roster id as overwriteId', () => {
    const onSave = vi.fn()
    render(
      <SaveRosterDialog
        open
        mode="overwrite"
        existingRosters={existingRosters}
        formats={FORMATS}
        onCancel={() => {}}
        onSave={onSave}
      />,
    )
    fireEvent.click(screen.getByText('Old Save B'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith('Old Save B', 'b', false)
  })
})
