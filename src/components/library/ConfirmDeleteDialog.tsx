/**
 * ConfirmDeleteDialog Component
 *
 * Modal dialog for confirming bulk deletion of collections.
 * Shows list of collections to be deleted and handles loading state.
 */

import { memo } from 'react'
import { Trash2, X, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CollectionMeta } from '@/stores/collectionStore'

interface ConfirmDeleteDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Close the dialog */
  onClose: () => void
  /** Confirm deletion */
  onConfirm: () => void
  /** Collections to be deleted (only deletable ones) */
  collections: CollectionMeta[]
  /** Number of preloaded collections that will be skipped */
  skippedCount: number
  /** Whether deletion is in progress */
  isDeleting: boolean
}

export const ConfirmDeleteDialog = memo(function ConfirmDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  collections,
  skippedCount,
  isDeleting,
}: ConfirmDeleteDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={isDeleting ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        className="relative card-elevated border border-white/10 max-w-md w-full mx-4 max-h-[80vh] flex flex-col animate-slide-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="icon-container icon-rose">
              {isDeleting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Trash2 className="h-5 w-5" />
              )}
            </div>
            <h2 id="delete-dialog-title" className="text-lg font-semibold">
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </h2>
          </div>
          {!isDeleting && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {isDeleting ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-destructive" />
                <div className="absolute inset-0 bg-destructive/20 blur-xl rounded-full" />
              </div>
              <p className="text-muted-foreground">
                Deleting {collections.length} collection{collections.length !== 1 ? 's' : ''}...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p id="delete-dialog-description" className="text-muted-foreground">
                Are you sure you want to delete {collections.length} collection
                {collections.length !== 1 ? 's' : ''}? This action cannot be undone.
              </p>

              {/* Skipped warning */}
              {skippedCount > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber/10 border border-amber/20">
                  <AlertTriangle className="h-5 w-5 text-amber shrink-0 mt-0.5" />
                  <p className="text-sm text-amber">
                    {skippedCount} preloaded collection{skippedCount !== 1 ? 's' : ''} will be
                    skipped (preloaded collections cannot be deleted).
                  </p>
                </div>
              )}

              {/* Collection list */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Collections to delete:
                </h3>
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {collections.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5"
                    >
                      <Trash2 className="h-4 w-4 text-destructive shrink-0" />
                      <span className="font-medium truncate">{c.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isDeleting && (
          <div className="p-5 border-t border-white/5 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-border/50 rounded-xl hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors',
                'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              )}
            >
              Delete {collections.length}
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

export default ConfirmDeleteDialog
