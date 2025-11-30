/**
 * usePatternEvaluation Hook
 *
 * Evaluates a pattern and builds segment mapping for inline highlighting.
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useCollectionStore } from '@/stores/collectionStore'
import { extractExpressions, parseExpression } from '@/engine/core/parser'
import type { ExpressionToken, RollTrace } from '@/engine/core'
import type {
  EvaluatedSegment,
  ExpressionType,
  PatternEvaluationResult,
} from './types'

/**
 * Count total nodes in a trace tree
 */
function countTraceNodes(trace: RollTrace | null): number {
  if (!trace) return 0
  return trace.stats.nodeCount
}

/**
 * Extract expression outputs from trace in order.
 * The root node's direct children correspond to the top-level expression evaluations.
 * Non-expression operations (like literal text) don't generate trace nodes.
 */
function extractExpressionOutputsFromTrace(trace: RollTrace | null): string[] {
  if (!trace) return []

  // The root node's direct children are the top-level operations
  // Each {{...}} expression generates one or more trace nodes
  // We collect outputs from immediate children of the root
  const outputs: string[] = []

  for (const child of trace.root.children) {
    outputs.push(String(child.output.value))
  }

  return outputs
}

/**
 * Determine the expression type from a parsed token
 */
function getExpressionType(token: ExpressionToken): ExpressionType {
  switch (token.type) {
    case 'dice':
      return 'dice'
    case 'math':
      return 'math'
    case 'variable':
      return 'variable'
    case 'placeholder':
      return 'placeholder'
    case 'again':
      return 'again'
    case 'multiRoll':
      return 'table'
    case 'table':
      return 'table'
    case 'instance':
      return 'table'
    case 'captureMultiRoll':
      return 'capture'
    case 'captureAccess':
      return 'variable'
    case 'collect':
      return 'collect'
    default:
      return 'unknown'
  }
}

/**
 * Determine expression type from raw expression string (quick heuristic)
 */
function getExpressionTypeFromString(expr: string): ExpressionType {
  const trimmed = expr.trim()

  if (trimmed.startsWith('collect:')) return 'collect'
  if (trimmed.includes(' >> $') || trimmed.includes('>>$')) return 'capture'
  if (trimmed.startsWith('dice:')) return 'dice'
  if (trimmed.startsWith('math:')) return 'math'
  if (trimmed.startsWith('$')) return 'variable'
  if (trimmed.startsWith('@')) return 'placeholder'
  if (trimmed === 'again' || trimmed.endsWith('*again')) return 'again'
  if (trimmed.startsWith('unique:')) return 'unique'
  if (/^\d+\*/.test(trimmed)) return 'table' // multi-roll

  return 'table' // default to table reference
}

interface UsePatternEvaluationOptions {
  /** Whether to enable tracing */
  enableTrace?: boolean
  /** Debounce delay in ms (0 to disable) */
  debounceMs?: number
  /** Template/table-level shared variables to evaluate before the pattern */
  sharedVariables?: Record<string, string>
}

interface UsePatternEvaluationReturn {
  /** Evaluation result with segments */
  result: PatternEvaluationResult | null
  /** Whether currently evaluating */
  isEvaluating: boolean
  /** Force re-evaluation */
  reroll: () => void
  /** Number of trace nodes */
  traceNodeCount: number
  /** Number of capture variables */
  captureCount: number
}

/**
 * Hook for evaluating patterns and building segment mapping
 */
export function usePatternEvaluation(
  pattern: string,
  collectionId: string | undefined,
  options: UsePatternEvaluationOptions = {}
): UsePatternEvaluationReturn {
  const { enableTrace = true, debounceMs = 300, sharedVariables } = options

  const { engine } = useCollectionStore()
  const [result, setResult] = useState<PatternEvaluationResult | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evalKey, setEvalKey] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const versionRef = useRef(0)

  /**
   * Build segments from pattern and evaluation result
   */
  const buildSegments = useCallback(
    (
      patternStr: string,
      expressions: ReturnType<typeof extractExpressions>,
      trace: RollTrace | null,
      fullText: string
    ): EvaluatedSegment[] => {
      const segments: EvaluatedSegment[] = []

      if (expressions.length === 0) {
        // No expressions - entire pattern is literal
        if (patternStr.length > 0) {
          segments.push({
            type: 'literal',
            text: patternStr,
            startInPattern: 0,
            endInPattern: patternStr.length,
          })
        }
        return segments
      }

      // Extract expression outputs from trace (in order)
      const traceOutputs = extractExpressionOutputsFromTrace(trace)

      // If we don't have trace outputs but have fullText, we can't reliably
      // map outputs back to expressions, so show the full text as result
      const useFullTextFallback = traceOutputs.length === 0 && fullText

      let lastEnd = 0

      for (let i = 0; i < expressions.length; i++) {
        const match = expressions[i]

        // Add literal segment before this expression
        if (match.start > lastEnd) {
          const literalText = patternStr.slice(lastEnd, match.start)
          segments.push({
            type: 'literal',
            text: literalText,
            startInPattern: lastEnd,
            endInPattern: match.start,
          })
        }

        // Get expression output from trace if available
        let exprOutput = ''
        let exprType: ExpressionType = 'unknown'

        try {
          // Try to parse the expression to get its type
          const token = parseExpression(match.expression)
          exprType = getExpressionType(token)
        } catch {
          // Fallback to heuristic type detection
          exprType = getExpressionTypeFromString(match.expression)
        }

        // Use trace output if available
        if (i < traceOutputs.length) {
          exprOutput = traceOutputs[i]
          // If the output is empty, show a placeholder to indicate it was evaluated
          if (exprOutput === '') {
            exprOutput = `[empty]`
          }
        } else if (useFullTextFallback && i === 0 && expressions.length === 1) {
          // Single expression with no trace - use full text as the output
          exprOutput = fullText || '[empty]'
        } else if (traceOutputs.length > 0 && i >= traceOutputs.length) {
          // We have some trace outputs but not enough - something went wrong
          exprOutput = `[?]`
        } else {
          // No trace output available - show placeholder
          exprOutput = `[${match.expression}]`
        }

        segments.push({
          type: 'expression',
          text: exprOutput,
          originalExpression: match.raw,
          expressionType: exprType,
          startInPattern: match.start,
          endInPattern: match.end,
        })

        lastEnd = match.end
      }

      // Add trailing literal segment
      if (lastEnd < patternStr.length) {
        const literalText = patternStr.slice(lastEnd)
        segments.push({
          type: 'literal',
          text: literalText,
          startInPattern: lastEnd,
          endInPattern: patternStr.length,
        })
      }

      return segments
    },
    []
  )

  /**
   * Perform the evaluation
   */
  const evaluate = useCallback(() => {
    const currentVersion = ++versionRef.current

    if (!pattern) {
      setResult({
        segments: [],
        fullText: '',
        trace: null,
        captures: null,
        error: null,
      })
      setIsEvaluating(false)
      return
    }

    if (!collectionId || !engine.hasCollection(collectionId)) {
      // Can't evaluate without collection - build segments with placeholders
      const expressions = extractExpressions(pattern)
      const segments = buildSegments(pattern, expressions, null, '')

      setResult({
        segments,
        fullText: pattern,
        trace: null,
        captures: null,
        error: null,
      })
      setIsEvaluating(false)
      return
    }

    setIsEvaluating(true)

    try {
      // Evaluate the full pattern with optional shared variables
      const evalResult = engine.evaluateRawPattern(pattern, collectionId, {
        enableTrace,
        shared: sharedVariables,
      })

      // Check if we're still the current version
      if (currentVersion !== versionRef.current) return

      // Extract expressions and build segments using trace outputs
      const expressions = extractExpressions(pattern)
      const trace = evalResult.trace ?? null
      const segments = buildSegments(pattern, expressions, trace, evalResult.text)

      setResult({
        segments,
        fullText: evalResult.text,
        trace,
        captures: evalResult.captures ?? null,
        error: null,
      })
    } catch (err) {
      // Check if we're still the current version
      if (currentVersion !== versionRef.current) return

      const errorMessage =
        err instanceof Error ? err.message : 'Evaluation failed'

      // Build segments with type info even on error
      const expressions = extractExpressions(pattern)
      const segments: EvaluatedSegment[] = []
      let lastEnd = 0

      for (const match of expressions) {
        if (match.start > lastEnd) {
          segments.push({
            type: 'literal',
            text: pattern.slice(lastEnd, match.start),
            startInPattern: lastEnd,
            endInPattern: match.start,
          })
        }

        segments.push({
          type: 'expression',
          text: `[error]`,
          originalExpression: match.raw,
          expressionType: getExpressionTypeFromString(match.expression),
          startInPattern: match.start,
          endInPattern: match.end,
        })

        lastEnd = match.end
      }

      if (lastEnd < pattern.length) {
        segments.push({
          type: 'literal',
          text: pattern.slice(lastEnd),
          startInPattern: lastEnd,
          endInPattern: pattern.length,
        })
      }

      setResult({
        segments,
        fullText: '',
        trace: null,
        captures: null,
        error: errorMessage,
      })
    } finally {
      if (currentVersion === versionRef.current) {
        setIsEvaluating(false)
      }
    }
  }, [pattern, collectionId, engine, enableTrace, sharedVariables, buildSegments])

  /**
   * Force re-evaluation (for re-roll button)
   */
  const reroll = useCallback(() => {
    setEvalKey((k) => k + 1)
  }, [])

  /**
   * Effect to evaluate pattern with debouncing
   */
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (debounceMs > 0) {
      setIsEvaluating(true)
      debounceRef.current = setTimeout(() => {
        evaluate()
      }, debounceMs)
    } else {
      evaluate()
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, collectionId, evalKey, enableTrace, sharedVariables])

  /**
   * Computed trace node count
   */
  const traceNodeCount = useMemo(() => {
    return countTraceNodes(result?.trace ?? null)
  }, [result?.trace])

  /**
   * Computed capture count
   */
  const captureCount = useMemo(() => {
    if (!result?.captures) return 0
    return Object.keys(result.captures).length
  }, [result?.captures])

  return {
    result,
    isEvaluating,
    reroll,
    traceNodeCount,
    captureCount,
  }
}

export default usePatternEvaluation
