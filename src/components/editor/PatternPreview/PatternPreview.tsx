/**
 * PatternPreview Component
 *
 * Rich, interactive pattern preview matching the Roller page's capabilities.
 * Features:
 * - Editable pattern with syntax highlighting
 * - Inline result display with highlighted evaluated expressions
 * - TraceViewer for debugging
 * - CaptureInspector for captured variables
 */

import {
  memo,
  useState,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { AlertCircle } from 'lucide-react'
import { TraceViewer } from '@/components/roller/TraceViewer'
import { CaptureInspector } from '@/components/roller/CaptureInspector'
import { EditablePattern, type EditablePatternRef } from './EditablePattern'
import { InlineResult } from './InlineResult'
import { PreviewControls } from './PreviewControls'
import { usePatternEvaluation } from './usePatternEvaluation'
import type { PatternPreviewProps } from './types'

/**
 * Main PatternPreview component
 */
export const PatternPreview = memo(
  forwardRef<EditablePatternRef, PatternPreviewProps>(function PatternPreview(
    {
      pattern,
      onChange,
      collectionId,
      placeholder = 'Enter your pattern using {{...}} syntax',
      minHeight = 250,
      sharedVariables,
      hidePreviewWhenEmpty = false,
      hideLabel = false,
      suggestions,
      tableMap,
      templateMap,
    },
    ref
  ) {
    const editorRef = useRef<EditablePatternRef>(null)

    // Forward the ref to the EditablePattern
    useImperativeHandle(ref, () => ({
      insertAtCursor: (text: string) => editorRef.current?.insertAtCursor(text),
      focus: () => editorRef.current?.focus(),
    }))
  const [showTrace, setShowTrace] = useState(false)
  const [showCaptures, setShowCaptures] = useState(false)

  // Evaluate pattern with segment mapping
  const { result, isEvaluating, reroll, traceNodeCount, captureCount } =
    usePatternEvaluation(pattern, collectionId, {
      enableTrace: true,
      debounceMs: 300,
      sharedVariables,
    })

  // Check what data we have
  const hasTrace = Boolean(result?.trace)
  const hasCaptures = captureCount > 0
  const hasError = Boolean(result?.error)
  const hasExpressions = Boolean(result?.segments.some((s) => s.type === 'expression'))

  // Toggle handlers
  const handleToggleTrace = useCallback(() => {
    setShowTrace((v) => !v)
    if (showTrace) {
      setShowCaptures(false) // Hide captures when hiding trace
    }
  }, [showTrace])

  const handleToggleCaptures = useCallback(() => {
    setShowCaptures((v) => !v)
  }, [])

  // Determine if we should show the preview section
  const showPreviewSection = !hidePreviewWhenEmpty || hasExpressions

  return (
    <div className="space-y-4">
      {/* Editable Pattern */}
      <div>
        {!hideLabel && (
          <label className="block text-sm font-medium mb-1">
            Pattern <span className="text-destructive">*</span>
          </label>
        )}
        <EditablePattern
          ref={editorRef}
          value={pattern}
          onChange={onChange}
          placeholder={placeholder}
          minHeight={minHeight}
          suggestions={suggestions}
          tableMap={tableMap}
          templateMap={templateMap}
        />
        {!hideLabel && (
          <p className="text-xs text-muted-foreground mt-1">
            Use {'{{tableId}}'} for table references, {'{{dice:XdY}}'} for dice,{' '}
            {'{{math:expr}}'} for math, {'{{$var}}'} for variables,{' '}
            {'{{3*table >> $var}}'} for captures
          </p>
        )}
      </div>

      {/* Preview Result Section - conditionally shown */}
      {showPreviewSection && (
        <div className="p-4 bg-muted/50 rounded-lg space-y-3 border border-border/50">
          {/* Header with controls */}
          <div className="flex items-start justify-between gap-4">
            <h4 className="text-sm font-medium">Preview Result</h4>
            <PreviewControls
              showTrace={showTrace}
              onToggleTrace={handleToggleTrace}
              showCaptures={showCaptures}
              onToggleCaptures={handleToggleCaptures}
              onReroll={reroll}
              isEvaluating={isEvaluating}
              traceNodeCount={traceNodeCount}
              captureCount={captureCount}
              hasTrace={hasTrace}
              hasCaptures={hasCaptures}
            />
          </div>

          {/* Error display */}
          {hasError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="text-sm text-destructive">{result?.error}</div>
            </div>
          )}

          {/* Inline result with highlighted expressions */}
          {!collectionId && hasExpressions ? (
            <div className="text-sm text-muted-foreground italic p-3 bg-background/50 rounded border border-border/30">
              Save the collection to enable live preview evaluation.
            </div>
          ) : result?.segments && result.segments.length > 0 ? (
            <div className="p-3 bg-background/50 rounded border border-border/30">
              <InlineResult segments={result.segments} />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic p-3 bg-background/50 rounded border border-border/30">
              {pattern ? 'Empty result' : 'Enter a pattern to see preview'}
            </div>
          )}

          {/* Trace Viewer */}
          {showTrace && result?.trace && (
            <div className="mt-4">
              <TraceViewer
                trace={result.trace}
                onClose={() => setShowTrace(false)}
              />
            </div>
          )}

          {/* Capture Inspector */}
          {showTrace && showCaptures && result?.captures && (
            <div className="mt-4">
              <CaptureInspector
                captures={result.captures}
                onClose={() => setShowCaptures(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
  })
)

export default PatternPreview
