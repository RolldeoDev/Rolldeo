/**
 * CurrentRollResult Component
 *
 * Displays the current roll result with re-roll option.
 * Descriptions are shown in a shared drawer managed by ResultsPanel.
 */

import { memo, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { RotateCcw, Activity, Grab, ClipboardCopy, Check, BookOpen, ListOrdered } from 'lucide-react'
import type { RollResult, EntryDescription, EvaluatedSets } from '@/engine/types'
import { TraceViewer } from './TraceViewer'
import { CaptureInspector } from './CaptureInspector'
import { getResultTypeIcon } from '@/lib/resultTypeIcons'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

interface CurrentRollResultProps {
  result: RollResult | null
  itemName: string | null
  isRolling: boolean
  error: string | null
  onReroll: () => void
  onShowDescriptions: (descriptions: EntryDescription[], sourceLabel?: string) => void
  onShowSets: (sets: EvaluatedSets, sourceLabel?: string) => void
}

export const CurrentRollResult = memo(function CurrentRollResult({
  result,
  itemName,
  isRolling,
  error,
  onReroll,
  onShowDescriptions,
  onShowSets,
}: CurrentRollResultProps) {
  const [showTrace, setShowTrace] = useState(false)
  const [showCaptures, setShowCaptures] = useState(false)
  const [copied, setCopied] = useState(false)
  const resultTheme = useUIStore((state) => state.resultTheme)

  const isTtrpg = resultTheme === 'ttrpg'

  const hasCaptures = result?.captures && Object.keys(result.captures).length > 0
  const captureCount = hasCaptures ? Object.keys(result!.captures!).length : 0

  const hasDescriptions = result?.descriptions && result.descriptions.length > 0
  const descriptionCount = hasDescriptions ? result!.descriptions!.length : 0

  // Count sets, excluding 'value' (which is always present as @value)
  const setsCount = result?.placeholders
    ? Object.keys(result.placeholders).filter((key) => key !== 'value').length
    : 0
  const hasSets = setsCount > 0

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

  const ResultIcon = getResultTypeIcon(result.resultType)

  return (
    <div className={cn(
      "mx-4 mt-4 mb-6 p-5 border animate-slide-up",
      isTtrpg
        ? "card-result-ttrpg"
        : "rounded-2xl card-elevated card-result shadow-lg shadow-copper/5"
    )}>
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="icon-container icon-copper"
            title={result.resultType ? `Type: ${result.resultType}` : undefined}
          >
            <ResultIcon className="h-5 w-5" />
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
            className={`p-2.5 rounded-xl transition-all ${
              copied
                ? 'text-green-500 bg-green-500/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
            title={copied ? 'Copied!' : 'Copy result to clipboard'}
            aria-label={copied ? 'Copied!' : 'Copy result to clipboard'}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-5 w-5" />
            ) : (
              <ClipboardCopy className="h-5 w-5" />
            )}
          </button>
          <button
            className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-50"
            title="Re-roll (Space or Enter)"
            aria-label="Re-roll"
            onClick={onReroll}
            disabled={isRolling}
          >
            <RotateCcw className={`h-5 w-5 ${isRolling ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      {/* Content with max-width for readability */}
      <div
        className={cn(
          "overflow-x-auto max-w-[70ch]",
          isTtrpg ? "prose-roll-ttrpg" : "prose-roll"
        )}
        style={{ lineHeight: '1.7' }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.text}</ReactMarkdown>
      </div>

      {/* Toggle buttons - standardized to copper accent */}
      <div className="mt-5 pt-4 border-t border-copper/10 flex flex-wrap gap-2">
        {/* Descriptions button - opens drawer */}
        {hasDescriptions && (
          <button
            onClick={() => onShowDescriptions(result!.descriptions!, itemName || undefined)}
            className="text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 text-muted-foreground border-border/50 hover:text-copper hover:border-copper/40 hover:bg-copper/10"
            title="View entry descriptions"
          >
            <BookOpen className="w-4 h-4" />
            Descriptions
            <span className="text-xs text-copper/60">
              {descriptionCount}
            </span>
          </button>
        )}

        {/* Sets button - opens drawer */}
        {hasSets && (
          <button
            onClick={() => onShowSets(result!.placeholders!, itemName || undefined)}
            className="text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 text-muted-foreground border-border/50 hover:text-copper hover:border-copper/40 hover:bg-copper/10"
            title="View entry sets/properties"
          >
            <ListOrdered className="w-4 h-4" />
            Sets
            <span className="text-xs text-copper/60">
              {setsCount}
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
                ? 'text-copper border-copper/40 bg-copper/10'
                : 'text-muted-foreground border-border/50 hover:text-copper hover:border-copper/40 hover:bg-copper/10'}
            `}
            title={showTrace ? 'Hide execution trace' : 'Show execution trace'}
          >
            <Activity className="w-4 h-4" />
            Trace
            <span className="text-xs text-copper/60">
              {result.trace.stats.nodeCount}
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
                ? 'text-copper border-copper/40 bg-copper/10'
                : 'text-muted-foreground border-border/50 hover:text-copper hover:border-copper/40 hover:bg-copper/10'}
            `}
            title={showCaptures ? 'Hide captured variables' : 'Show captured variables'}
          >
            <Grab className="w-4 h-4" />
            Captures
            <span className="text-xs text-copper/60">
              {captureCount}
            </span>
          </button>
        )}
      </div>

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
