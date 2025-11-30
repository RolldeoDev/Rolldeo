/**
 * ConflictDialog Component
 *
 * Modal dialog for resolving import conflicts when a collection
 * with the same namespace/version already exists.
 */

import { AlertTriangle, X, Replace, Copy, SkipForward } from 'lucide-react'
import type { ImportedCollection } from '../../services/import'
import { cn } from '../../lib/utils'

export interface ConflictResolution {
  /** The conflicting collection */
  collection: ImportedCollection
  /** How to resolve the conflict */
  action: 'replace' | 'keep-both' | 'skip'
}

interface ConflictDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Close the dialog */
  onClose: () => void
  /** The conflicting collection info */
  conflict: {
    incoming: ImportedCollection
    existingId: string
    existingName: string
  } | null
  /** Called when user resolves the conflict */
  onResolve: (resolution: ConflictResolution) => void
}

export function ConflictDialog({
  isOpen,
  onClose,
  conflict,
  onResolve,
}: ConflictDialogProps) {
  if (!isOpen || !conflict) return null

  const handleReplace = () => {
    onResolve({ collection: conflict.incoming, action: 'replace' })
  }

  const handleKeepBoth = () => {
    onResolve({ collection: conflict.incoming, action: 'keep-both' })
  }

  const handleSkip = () => {
    onResolve({ collection: conflict.incoming, action: 'skip' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-dialog-title"
        className="relative bg-card rounded-lg shadow-xl max-w-md w-full mx-4"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
          </div>
          <div className="flex-1">
            <h2 id="conflict-dialog-title" className="text-lg font-semibold">
              Collection Already Exists
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-muted-foreground">
            A collection with similar metadata already exists. How would you like
            to proceed?
          </p>

          {/* Comparison */}
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Existing Collection
              </p>
              <p className="font-medium">{conflict.existingName}</p>
              <p className="text-xs text-muted-foreground">{conflict.existingId}</p>
            </div>

            <div className="p-3 rounded-lg border border-primary/50 bg-primary/5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Importing
              </p>
              <p className="font-medium">{conflict.incoming.name}</p>
              <p className="text-xs text-muted-foreground">
                {conflict.incoming.fileName}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleReplace}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors',
                'hover:bg-muted hover:border-primary',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
              )}
            >
              <Replace className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium">Replace Existing</p>
                <p className="text-sm text-muted-foreground">
                  Overwrite the existing collection with the new import
                </p>
              </div>
            </button>

            <button
              onClick={handleKeepBoth}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors',
                'hover:bg-muted hover:border-primary',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
              )}
            >
              <Copy className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium">Keep Both</p>
                <p className="text-sm text-muted-foreground">
                  Import with a unique identifier suffix
                </p>
              </div>
            </button>

            <button
              onClick={handleSkip}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors',
                'hover:bg-muted hover:border-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
              )}
            >
              <SkipForward className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium">Skip</p>
                <p className="text-sm text-muted-foreground">
                  Don't import this collection
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
