/**
 * ExportDialog Component
 *
 * Modal dialog for exporting collections with optional dependencies.
 * Shows when a collection has imports, asking if user wants to bundle them.
 */

import { useState, useCallback, useMemo } from 'react'
import {
  Download,
  Package,
  Link2,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { useCollectionStore } from '@/stores/collectionStore'
import {
  exportAsJson,
  exportAsZip,
  resolveExportDependencies,
} from '@/services/export'
import type { RandomTableDocument } from '@/engine/types'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  document: RandomTableDocument
  collectionId?: string
}

type ExportPhase = 'choice' | 'resolving' | 'complete'

export function ExportDialog({
  isOpen,
  onClose,
  document,
  collectionId,
}: ExportDialogProps) {
  const engine = useCollectionStore((state) => state.engine)
  const collections = useCollectionStore((state) => state.collections)

  const [phase, setPhase] = useState<ExportPhase>('choice')
  const [error, setError] = useState<string | null>(null)
  const [unresolvedWarnings, setUnresolvedWarnings] = useState<string[]>([])
  const [exportedCount, setExportedCount] = useState(0)

  const imports = useMemo(() => document.imports || [], [document.imports])

  // Reset state when dialog opens
  const handleClose = useCallback(() => {
    setPhase('choice')
    setError(null)
    setUnresolvedWarnings([])
    setExportedCount(0)
    onClose()
  }, [onClose])

  // Export just this collection
  const handleExportSingle = useCallback(() => {
    exportAsJson(document)
    handleClose()
  }, [document, handleClose])

  // Export with all dependencies
  const handleExportWithDeps = useCallback(async () => {
    setPhase('resolving')
    setError(null)

    try {
      // Small delay to ensure UI updates
      await new Promise((resolve) => setTimeout(resolve, 100))

      const resolved = resolveExportDependencies(
        document,
        collectionId,
        engine,
        collections
      )

      if (resolved.unresolvedPaths.length > 0) {
        setUnresolvedWarnings(resolved.unresolvedPaths)
      }

      // Combine primary + dependencies for ZIP
      const allCollections = [resolved.primary, ...resolved.dependencies]
      setExportedCount(allCollections.length)

      // Generate ZIP filename from primary collection
      const zipName = `${document.metadata.namespace || 'collection'}-bundle.zip`

      await exportAsZip(allCollections, zipName)

      setPhase('complete')

      // Auto-close after brief success display
      setTimeout(() => {
        handleClose()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
      setPhase('choice')
    }
  }, [document, collectionId, engine, collections, handleClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={phase === 'choice' ? handleClose : undefined}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="relative card-elevated border border-white/10 max-w-md w-full mx-4 animate-slide-up"
      >
        {phase === 'choice' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="icon-container icon-amber">
                  <Package className="h-5 w-5" />
                </div>
                <h2
                  id="export-dialog-title"
                  className="text-lg font-semibold"
                >
                  Export with Dependencies?
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <p className="text-muted-foreground">
                This collection references {imports.length} external collection
                {imports.length !== 1 ? 's' : ''}. Would you like to include
                them in the export?
              </p>

              {/* Import list */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {imports.map((imp) => (
                  <div
                    key={imp.alias}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                  >
                    <Link2 className="h-4 w-4 text-[hsl(var(--amber))] shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{imp.alias}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {imp.path}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-white/5 flex gap-3">
              <button
                onClick={handleExportSingle}
                className="flex-1 px-4 py-2 border border-border/50 rounded-xl hover:bg-accent transition-colors"
              >
                Export Only This
              </button>
              <button
                onClick={handleExportWithDeps}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Include Dependencies
              </button>
            </div>
          </>
        )}

        {phase === 'resolving' && (
          <div className="p-8">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">
                  Resolving dependencies...
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  This may take a moment for larger collections
                </p>
              </div>
            </div>
          </div>
        )}

        {phase === 'complete' && (
          <div className="p-8">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="icon-container icon-mint">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-mint">Export Complete!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {exportedCount} collection{exportedCount !== 1 ? 's' : ''}{' '}
                  exported
                </p>
                {unresolvedWarnings.length > 0 && (
                  <p className="text-sm text-amber-500 mt-2">
                    {unresolvedWarnings.length} import
                    {unresolvedWarnings.length !== 1 ? 's' : ''} could not be
                    resolved
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExportDialog
