/**
 * CurrentRollResult Component
 *
 * Displays the current roll result with re-roll option.
 */

import { memo, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sparkles, RotateCcw, Activity, Grab, ClipboardCopy, Check, BookOpen } from 'lucide-react'
import type { RollResult } from '@/engine/types'
import { TraceViewer } from './TraceViewer'
import { CaptureInspector } from './CaptureInspector'
import { DescriptionsViewer } from './DescriptionsViewer'

interface CurrentRollResultProps {
  result: RollResult | null
  itemName: string | null
  isRolling: boolean
  error: string | null
  onReroll: () => void
}

export const CurrentRollResult = memo(function CurrentRollResult({
  result,
  itemName,
  isRolling,
  error,
  onReroll,
}: CurrentRollResultProps) {
  const [showTrace, setShowTrace] = useState(false)
  const [showCaptures, setShowCaptures] = useState(false)
  const [showDescriptions, setShowDescriptions] = useState(false)
  const [copied, setCopied] = useState(false)

  const hasCaptures = result?.captures && Object.keys(result.captures).length > 0
  const captureCount = hasCaptures ? Object.keys(result!.captures!).length : 0

  const hasDescriptions = result?.descriptions && result.descriptions.length > 0
  const descriptionCount = hasDescriptions ? result!.descriptions!.length : 0

  const handleCopy = useCallback(async () => {
    if (!result?.text) return
    try {
      await navigator.clipboard.writeText(result.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [result?.text])

  if (error) {
    return (
      <div className="mx-4 mt-4 p-4 rounded-xl border border-destructive/20 bg-destructive/5">
        <p className="text-destructive text-center">{error}</p>
      </div>
    )
  }

  if (!result) {
    return null
  }

  return (
    <div className="mx-4 mt-4 p-5 rounded-xl card-elevated card-mint border animate-slide-up">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="icon-container icon-mint">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Result</h3>
            {itemName && (
              <p className="text-sm text-muted-foreground">{itemName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            className={`p-2.5 rounded-xl transition-colors ${
              copied ? 'text-green-500' : 'hover:bg-accent'
            }`}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-5 w-5" />
            ) : (
              <ClipboardCopy className="h-5 w-5" />
            )}
          </button>
          <button
            className="p-2.5 rounded-xl hover:bg-accent transition-colors"
            title="Re-roll"
            onClick={onReroll}
            disabled={isRolling}
          >
            <RotateCcw className={`h-5 w-5 ${isRolling ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="prose-roll overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.text}</ReactMarkdown>
      </div>

      {/* Toggle buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Descriptions toggle button - only shown if descriptions exist */}
        {hasDescriptions && (
          <button
            onClick={() => setShowDescriptions(!showDescriptions)}
            className={`
              text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all
              ${showDescriptions
                ? 'text-amber-400 border-amber-400/40 bg-amber-400/10'
                : 'text-muted-foreground border-border/50 hover:border-border hover:bg-accent'}
            `}
          >
            <BookOpen className="w-4 h-4" />
            {showDescriptions ? 'Hide' : 'Show'} Descriptions
            <span className="text-muted-foreground/60 text-xs">
              ({descriptionCount})
            </span>
          </button>
        )}

        {/* Trace toggle button - only shown if trace exists */}
        {result.trace && (
          <button
            onClick={() => setShowTrace(!showTrace)}
            className={`
              text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all
              ${showTrace
                ? 'text-primary border-primary/40 bg-primary/10'
                : 'text-muted-foreground border-border/50 hover:border-border hover:bg-accent'}
            `}
          >
            <Activity className="w-4 h-4" />
            {showTrace ? 'Hide' : 'Show'} Trace
            <span className="text-muted-foreground/60 text-xs">
              ({result.trace.stats.nodeCount} ops)
            </span>
          </button>
        )}

        {/* Capture toggle button - only shown if trace is visible and captures exist */}
        {showTrace && hasCaptures && (
          <button
            onClick={() => setShowCaptures(!showCaptures)}
            className={`
              text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all
              ${showCaptures
                ? 'text-rose-400 border-rose-400/40 bg-rose-400/10'
                : 'text-muted-foreground border-border/50 hover:border-border hover:bg-accent'}
            `}
          >
            <Grab className="w-4 h-4" />
            {showCaptures ? 'Hide' : 'Show'} Captures
            <span className="text-muted-foreground/60 text-xs">
              ({captureCount} var{captureCount !== 1 ? 's' : ''})
            </span>
          </button>
        )}
      </div>

      {/* Descriptions viewer */}
      {showDescriptions && hasDescriptions && (
        <div className="mt-4">
          <DescriptionsViewer
            descriptions={result.descriptions!}
            onClose={() => setShowDescriptions(false)}
          />
        </div>
      )}

      {/* Trace viewer */}
      {showTrace && result.trace && (
        <div className="mt-4">
          <TraceViewer trace={result.trace} onClose={() => setShowTrace(false)} />
        </div>
      )}

      {/* Capture inspector - only shown when trace is visible */}
      {showTrace && showCaptures && hasCaptures && (
        <div className="mt-4">
          <CaptureInspector captures={result.captures!} onClose={() => setShowCaptures(false)} />
        </div>
      )}
    </div>
  )
})

export default CurrentRollResult
