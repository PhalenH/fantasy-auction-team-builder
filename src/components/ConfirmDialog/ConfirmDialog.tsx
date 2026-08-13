// Generic yes/no confirmation modal, styled to match an iOS-alert-style
// layout (centered card, divider, two text-only buttons split by a
// vertical divider) rather than the browser's native window.confirm().
// Deliberately app-wide reusable — the clear-roster flow is its first
// caller, but nothing here is specific to rosters.

import { useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Escape mirrors window.confirm()'s own keyboard behavior (Esc cancels),
  // so swapping to this component doesn't remove a keyboard affordance
  // users already had.
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-72 overflow-hidden rounded-lg bg-white shadow-lg"
      >
        <div className="px-4 pb-5 pt-5 text-center">
          <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-900">
            {title}
          </h2>
          <p id="confirm-dialog-message" className="mt-2 text-sm text-slate-500">
            {message}
          </p>
        </div>

        <div className="flex divide-x divide-slate-200 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 text-sm font-semibold text-accent-green hover:bg-slate-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
