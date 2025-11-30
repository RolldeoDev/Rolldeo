/**
 * ImportDialog Component
 *
 * Modal dialog showing import progress and results.
 * Displays success/error counts and individual file results.
 */

import { CheckCircle2, XCircle, Loader2, X, FileCheck, AlertCircle } from 'lucide-react'
import type { ImportResult } from '../../services/import'
import { cn } from '../../lib/utils'

interface ImportDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Close the dialog */
  onClose: () => void
  /** Import result to display */
  result: ImportResult | null
  /** Whether import is in progress */
  isImporting: boolean
}

export function ImportDialog({
  isOpen,
  onClose,
  result,
  isImporting,
}: ImportDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={isImporting ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        className="relative card-elevated border border-white/10 max-w-md w-full mx-4 max-h-[80vh] flex flex-col animate-slide-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className={cn(
              'icon-container',
              isImporting ? 'icon-amber' : result?.success ? 'icon-mint' : 'icon-rose'
            )}>
              {isImporting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : result?.success ? (
                <FileCheck className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </div>
            <h2 id="import-dialog-title" className="text-lg font-semibold">
              {isImporting ? 'Importing...' : 'Import Results'}
            </h2>
          </div>
          {!isImporting && (
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
          {isImporting ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              </div>
              <p className="text-muted-foreground">Processing files...</p>
            </div>
          ) : result ? (
            <div className="space-y-5">
              {/* Summary */}
              <div className={cn(
                'flex items-center gap-4 p-4 rounded-xl border',
                result.success
                  ? 'card-mint border-[hsl(var(--mint)/0.2)]'
                  : 'card-rose border-[hsl(var(--rose)/0.2)]'
              )}>
                {result.success ? (
                  <CheckCircle2 className="h-6 w-6 text-mint shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-rose shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {result.collections.length} collection
                    {result.collections.length !== 1 ? 's' : ''} imported
                  </p>
                  {result.errors.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {result.errors.length} error
                      {result.errors.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Successful imports */}
              {result.collections.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-mint flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Imported Successfully
                  </h3>
                  <ul className="space-y-2">
                    {result.collections.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground pill pill-outline">
                          {c.fileName}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-rose flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4" />
                    Errors
                  </h3>
                  <ul className="space-y-2">
                    {result.errors.map((e, i) => (
                      <li
                        key={i}
                        className="p-3 rounded-xl bg-rose/5 border border-rose/10"
                      >
                        <p className="font-medium text-sm mb-1">{e.fileName}</p>
                        <p className="text-rose text-sm">{e.error}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!isImporting && (
          <div className="p-5 border-t border-white/5">
            <button
              onClick={onClose}
              className="btn-primary w-full"
            >
              {result?.success ? 'Continue to Library' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
