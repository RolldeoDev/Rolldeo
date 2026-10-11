/**
 * PreviewControls Component
 *
 * Toolbar with re-roll button and debug toggles (trace, captures).
 */

import { memo } from 'react'
import { RefreshCw, Activity, Grab } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PreviewControlsProps } from './types'

export const PreviewControls = memo(function PreviewControls({
  showTrace,
  onToggleTrace,
  showCaptures,
  onToggleCaptures,
  onReroll,
  isEvaluating,
  traceNodeCount = 0,
  captureCount = 0,
  hasTrace,
  hasCaptures,
}: PreviewControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Re-roll button */}
      <button
        type="button"
        onClick={onReroll}
        disabled={isEvaluating}
        className={cn(
          'text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all',
          'text-muted-foreground border-border/50 hover:border-border hover:bg-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'active:scale-95'
        )}
        title="Re-roll preview (evaluate again)"
      >
        <RefreshCw
          className={cn('w-4 h-4', isEvaluating && 'animate-spin')}
        />
        Re-roll
      </button>

      {/* Trace toggle button - only shown if trace exists */}
      {hasTrace && (
        <button
          type="button"
          onClick={onToggleTrace}
          className={cn(
            'text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all',
            showTrace
              ? 'text-primary border-primary/40 bg-primary/10'
              : 'text-muted-foreground border-border/50 hover:border-border hover:bg-accent'
          )}
        >
          <Activity className="w-4 h-4" />
          {showTrace ? 'Hide' : 'Show'} Trace
          {traceNodeCount > 0 && (
            <span className="text-muted-foreground/60 text-xs">
              ({traceNodeCount} ops)
            </span>
          )}
        </button>
      )}

      {/* Capture toggle button - only shown if trace is visible and captures exist */}
      {showTrace && hasCaptures && (
        <button
          type="button"
          onClick={onToggleCaptures}
          className={cn(
            'text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all',
            showCaptures
              ? 'text-rose-400 border-rose-400/40 bg-rose-400/10'
              : 'text-muted-foreground border-border/50 hover:border-border hover:bg-accent'
          )}
        >
          <Grab className="w-4 h-4" />
          {showCaptures ? 'Hide' : 'Show'} Captures
          <span className="text-muted-foreground/60 text-xs">
            ({captureCount} var{captureCount !== 1 ? 's' : ''})
          </span>
        </button>
      )}

      {/* Loading indicator */}
      {isEvaluating && (
        <span className="text-xs text-muted-foreground">Evaluating...</span>
      )}
    </div>
  )
})

export default PreviewControls
