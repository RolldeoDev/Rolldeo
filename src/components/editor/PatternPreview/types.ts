/**
 * Types for PatternPreview component
 */

import type { RollTrace } from '@/engine/core'
import type { CaptureVariable } from '@/engine/types'

/**
 * A segment of evaluated pattern output.
 * Patterns are split into alternating literal text and evaluated expressions.
 */
export interface EvaluatedSegment {
  /** Type of segment */
  type: 'literal' | 'expression'
  /** The output text for this segment */
  text: string
  /** For expressions: the original {{...}} syntax */
  originalExpression?: string
  /** For expressions: the type (dice, table, variable, etc.) */
  expressionType?: ExpressionType
  /** Start position in original pattern */
  startInPattern: number
  /** End position in original pattern */
  endInPattern: number
}

/**
 * Expression types for color coding
 */
export type ExpressionType =
  | 'dice'
  | 'math'
  | 'table'
  | 'variable'
  | 'placeholder'
  | 'again'
  | 'unique'
  | 'capture'
  | 'capture-shared'
  | 'collect'
  | 'switch'
  | 'template'
  | 'unknown'

/**
 * Result of pattern evaluation with segment mapping
 */
export interface PatternEvaluationResult {
  /** Segments alternating between literal text and evaluated expressions */
  segments: EvaluatedSegment[]
  /** Full evaluated text */
  fullText: string
  /** Execution trace (if trace enabled) */
  trace: RollTrace | null
  /** Captured variables */
  captures: Record<string, CaptureVariable> | null
  /** Error message if evaluation failed */
  error: string | null
}

/**
 * Props for the main PatternPreview component
 */
export interface PatternPreviewProps {
  /** The pattern to preview */
  pattern: string
  /** Called when pattern is edited in the preview */
  onChange: (pattern: string) => void
  /** Collection ID for evaluation context */
  collectionId?: string
  /** Available table IDs for syntax helpers */
  availableTableIds?: string[]
  /** Available template IDs for syntax helpers */
  availableTemplateIds?: string[]
  /** Placeholder text when pattern is empty */
  placeholder?: string
  /** Minimum height for the editor */
  minHeight?: number
  /** Template/table-level shared variables to evaluate before the pattern */
  sharedVariables?: Record<string, string>
  /** Hide the preview section when pattern has no {{...}} expressions */
  hidePreviewWhenEmpty?: boolean
  /** Hide the pattern label (use when parent provides its own label) */
  hideLabel?: boolean
}

/**
 * Props for InlineResult component
 */
export interface InlineResultProps {
  /** Evaluated segments to display */
  segments: EvaluatedSegment[]
  /** Whether to show the result or just the pattern */
  showResult: boolean
}

/**
 * Props for EditablePattern component
 */
export interface EditablePatternProps {
  /** Current pattern value */
  value: string
  /** Called when pattern changes */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Minimum height */
  minHeight?: number
  /** ID for label association */
  id?: string
}

/**
 * Props for PreviewControls component
 */
export interface PreviewControlsProps {
  /** Whether trace is currently shown */
  showTrace: boolean
  /** Toggle trace visibility */
  onToggleTrace: () => void
  /** Whether captures are currently shown */
  showCaptures: boolean
  /** Toggle captures visibility */
  onToggleCaptures: () => void
  /** Re-roll the preview */
  onReroll: () => void
  /** Whether currently evaluating */
  isEvaluating: boolean
  /** Number of trace nodes (for badge) */
  traceNodeCount?: number
  /** Number of capture variables (for badge) */
  captureCount?: number
  /** Whether trace data exists */
  hasTrace: boolean
  /** Whether capture data exists */
  hasCaptures: boolean
}
