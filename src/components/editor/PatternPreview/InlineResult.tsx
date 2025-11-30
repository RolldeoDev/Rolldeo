/**
 * InlineResult Component
 *
 * Displays evaluated pattern with Markdown support and inline highlighting
 * of expression results. Each expression segment shows its evaluated value
 * with colored background and tooltip showing the original {{...}} syntax.
 */

import { memo, useMemo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import type { EvaluatedSegment, ExpressionType } from './types'

interface InlineResultProps {
  /** Evaluated segments to display */
  segments: EvaluatedSegment[]
  /** Optional className for container */
  className?: string
  /** Whether to enable markdown rendering (default: true) */
  enableMarkdown?: boolean
}

/**
 * Get CSS classes for expression type
 */
function getExpressionClasses(type: ExpressionType): string {
  const baseClasses =
    'inline-result-expression px-1 py-0.5 rounded cursor-help transition-colors'

  const colorClasses: Record<ExpressionType, string> = {
    dice: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25',
    math: 'bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/25',
    table:
      'bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25',
    template:
      'bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25',
    variable:
      'bg-orange-500/15 text-orange-600 dark:text-orange-400 hover:bg-orange-500/25',
    placeholder:
      'bg-pink-500/15 text-pink-600 dark:text-pink-400 hover:bg-pink-500/25',
    again:
      'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/25',
    unique:
      'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/25',
    capture:
      'bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25',
    collect:
      'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25',
    unknown:
      'bg-gray-500/15 text-gray-600 dark:text-gray-400 hover:bg-gray-500/25',
  }

  return cn(baseClasses, colorClasses[type])
}

/**
 * Get human-readable label for expression type
 */
function getExpressionLabel(type: ExpressionType): string {
  const labels: Record<ExpressionType, string> = {
    dice: 'Dice Roll',
    math: 'Math',
    table: 'Table',
    template: 'Template',
    variable: 'Variable',
    placeholder: 'Placeholder',
    again: 'Re-roll',
    unique: 'Unique',
    capture: 'Capture',
    collect: 'Collect',
    unknown: 'Expression',
  }
  return labels[type]
}

// Unique marker for expression boundaries - use HTML-safe markers
const EXPR_START = '\u2060\u200B' // Word joiner + zero-width space
const EXPR_END = '\u200B\u2060'
const EXPR_SEP = '\u200D' // Zero-width joiner

interface ExpressionInfo {
  text: string
  type: ExpressionType
  original: string
}

/**
 * Build markdown text with expression markers
 */
function buildMarkedText(segments: EvaluatedSegment[]): {
  text: string
  expressions: ExpressionInfo[]
} {
  const expressions: ExpressionInfo[] = []
  let text = ''

  for (const segment of segments) {
    if (segment.type === 'literal') {
      text += segment.text
    } else {
      // Mark expression with unique markers and index
      const idx = expressions.length
      expressions.push({
        text: segment.text,
        type: segment.expressionType || 'unknown',
        original: segment.originalExpression || '',
      })
      text += `${EXPR_START}${idx}${EXPR_SEP}${segment.text}${EXPR_END}`
    }
  }

  return { text, expressions }
}

/**
 * Parse text nodes to find and highlight expression markers
 */
function parseTextWithExpressions(
  text: string,
  expressions: ExpressionInfo[],
  keyPrefix: string
): ReactNode[] {
  const parts: ReactNode[] = []
  let remaining = text
  let keyIndex = 0

  while (remaining.length > 0) {
    const startIdx = remaining.indexOf(EXPR_START)

    if (startIdx === -1) {
      // No more markers, add remaining text
      if (remaining) {
        parts.push(remaining)
      }
      break
    }

    // Add text before the marker
    if (startIdx > 0) {
      parts.push(remaining.slice(0, startIdx))
    }

    // Find the separator and end marker
    const sepIdx = remaining.indexOf(EXPR_SEP, startIdx)
    const endIdx = remaining.indexOf(EXPR_END, sepIdx)

    if (sepIdx === -1 || endIdx === -1) {
      // Malformed marker, add rest as text
      parts.push(remaining.slice(startIdx))
      break
    }

    // Extract expression index and text
    const exprIdxStr = remaining.slice(startIdx + EXPR_START.length, sepIdx)
    const exprIdx = parseInt(exprIdxStr, 10)
    const exprText = remaining.slice(sepIdx + EXPR_SEP.length, endIdx)

    if (!isNaN(exprIdx) && expressions[exprIdx]) {
      const expr = expressions[exprIdx]
      const classes = getExpressionClasses(expr.type)
      const label = getExpressionLabel(expr.type)
      const tooltip = expr.original ? `${label}: ${expr.original}` : label

      parts.push(
        <span
          key={`${keyPrefix}-expr-${keyIndex++}`}
          className={classes}
          title={tooltip}
        >
          {exprText}
        </span>
      )
    } else {
      // Fallback: just show the text
      parts.push(exprText)
    }

    remaining = remaining.slice(endIdx + EXPR_END.length)
  }

  return parts
}

/**
 * Process children recursively to handle expression markers
 */
function processChildren(
  children: ReactNode,
  expressions: ExpressionInfo[],
  keyPrefix: string
): ReactNode {
  if (typeof children === 'string') {
    const parsed = parseTextWithExpressions(children, expressions, keyPrefix)
    return parsed.length === 1 ? parsed[0] : <>{parsed}</>
  }

  if (Array.isArray(children)) {
    return children.map((child, idx) =>
      processChildren(child, expressions, `${keyPrefix}-${idx}`)
    )
  }

  return children
}

/**
 * Render a single segment (non-markdown mode)
 */
const SegmentRenderer = memo(function SegmentRenderer({
  segment,
  index,
}: {
  segment: EvaluatedSegment
  index: number
}) {
  if (segment.type === 'literal') {
    // Preserve whitespace in literal segments
    return (
      <span key={index} className="whitespace-pre-wrap">
        {segment.text}
      </span>
    )
  }

  // Expression segment with highlighting
  const classes = getExpressionClasses(segment.expressionType || 'unknown')
  const label = getExpressionLabel(segment.expressionType || 'unknown')
  const tooltip = segment.originalExpression
    ? `${label}: ${segment.originalExpression}`
    : label

  return (
    <span key={index} className={classes} title={tooltip}>
      {segment.text}
    </span>
  )
})

/**
 * InlineResult displays the evaluated pattern with highlighted expressions
 */
export const InlineResult = memo(function InlineResult({
  segments,
  className,
  enableMarkdown = true,
}: InlineResultProps) {
  // Build marked text and expression info
  const { text: markedText, expressions } = useMemo(
    () => buildMarkedText(segments),
    [segments]
  )

  // Check if content has any markdown syntax
  const hasMarkdownSyntax = useMemo(() => {
    const plainText = segments.map((s) => s.text).join('')
    // Simple heuristic: check for common markdown patterns
    return /[*_#`\[\]|>-]|\n/.test(plainText)
  }, [segments])

  if (segments.length === 0) {
    return (
      <div
        className={cn(
          'text-sm text-muted-foreground italic whitespace-pre-wrap',
          className
        )}
      >
        Empty result
      </div>
    )
  }

  // Use markdown rendering when enabled and content might have markdown
  if (enableMarkdown && hasMarkdownSyntax) {
    return (
      <div className={cn('prose-roll overflow-x-auto', className)}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Override paragraph to process expression markers
            p: ({ children }) => (
              <p>{processChildren(children, expressions, 'p')}</p>
            ),
            // Override other text-containing elements
            li: ({ children }) => (
              <li>{processChildren(children, expressions, 'li')}</li>
            ),
            td: ({ children }) => (
              <td>{processChildren(children, expressions, 'td')}</td>
            ),
            th: ({ children }) => (
              <th>{processChildren(children, expressions, 'th')}</th>
            ),
            strong: ({ children }) => (
              <strong>{processChildren(children, expressions, 'strong')}</strong>
            ),
            em: ({ children }) => (
              <em>{processChildren(children, expressions, 'em')}</em>
            ),
            blockquote: ({ children }) => (
              <blockquote>
                {processChildren(children, expressions, 'blockquote')}
              </blockquote>
            ),
            // Code blocks should strip markers
            code: ({ className: codeClassName, children, ...props }) => {
              let content =
                typeof children === 'string' ? children : String(children ?? '')
              // Strip expression markers from code
              const markerRegex = new RegExp(
                `${EXPR_START}\\d+${EXPR_SEP}([^${EXPR_END[0]}]*)${EXPR_END}`,
                'g'
              )
              content = content.replace(markerRegex, '$1')

              return (
                <code className={codeClassName} {...props}>
                  {content}
                </code>
              )
            },
          }}
        >
          {markedText}
        </ReactMarkdown>
      </div>
    )
  }

  // Simple non-markdown rendering
  return (
    <div
      className={cn(
        'text-sm whitespace-pre-wrap break-words leading-relaxed',
        className
      )}
    >
      {segments.map((segment, index) => (
        <SegmentRenderer key={index} segment={segment} index={index} />
      ))}
    </div>
  )
})

export default InlineResult
