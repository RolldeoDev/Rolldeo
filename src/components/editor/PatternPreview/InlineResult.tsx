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
import { EXPRESSION_COLORS } from './expressionColors'
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
 * Get CSS classes for expression type.
 * Uses centralized color map for consistency with pattern input.
 */
function getExpressionClasses(type: ExpressionType): string {
  const baseClasses =
    'inline-result-expression px-1 py-0.5 rounded cursor-help transition-colors'

  return cn(baseClasses, EXPRESSION_COLORS[type].badge)
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
    'capture-shared': 'Capture Shared',
    collect: 'Collect',
    switch: 'Switch',
    unknown: 'Expression',
  }
  return labels[type]
}

// Unique marker for expression boundaries - use only zero-width characters
// No visible index numbers to avoid display issues when markdown splits text
const EXPR_START = '\u2060\u200B\u200D' // Word joiner + zero-width space + zero-width joiner
const EXPR_END = '\u200D\u200B\u2060' // Zero-width joiner + zero-width space + word joiner

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
      // Mark expression with unique markers (no visible index)
      expressions.push({
        text: segment.text,
        type: segment.expressionType || 'unknown',
        original: segment.originalExpression || '',
      })
      text += `${EXPR_START}${segment.text}${EXPR_END}`
    }
  }

  return { text, expressions }
}

/**
 * Parse text nodes to find and highlight expression markers.
 * Uses a counter object to track expression index across multiple text nodes
 * (since markdown can split an expression across multiple elements).
 */
function parseTextWithExpressions(
  text: string,
  expressions: ExpressionInfo[],
  keyPrefix: string,
  exprCounter: { current: number } = { current: 0 }
): ReactNode[] {
  const parts: ReactNode[] = []
  let remaining = text
  let keyIndex = 0

  while (remaining.length > 0) {
    const startIdx = remaining.indexOf(EXPR_START)
    const endIdx = remaining.indexOf(EXPR_END)

    // Case 1: No markers at all - just text
    if (startIdx === -1 && endIdx === -1) {
      if (remaining) {
        parts.push(
          <span key={`${keyPrefix}-text-${keyIndex++}`}>{remaining}</span>
        )
      }
      break
    }

    // Case 2: Only end marker (continuation from previous element due to markdown split)
    if (startIdx === -1 || (endIdx !== -1 && endIdx < startIdx)) {
      // Text before end marker is part of current expression
      const exprText = remaining.slice(0, endIdx)
      if (exprText) {
        const exprIdx = exprCounter.current
        if (expressions[exprIdx]) {
          const expr = expressions[exprIdx]
          const classes = getExpressionClasses(expr.type)
          const label = getExpressionLabel(expr.type)
          const tooltip = expr.original ? `${label}: ${expr.original}` : label

          parts.push(
            <span key={`${keyPrefix}-expr-${keyIndex++}`} className={classes} title={tooltip}>
              {exprText}
            </span>
          )
        } else {
          parts.push(
            <span key={`${keyPrefix}-text-${keyIndex++}`}>{exprText}</span>
          )
        }
      }
      exprCounter.current++
      remaining = remaining.slice(endIdx + EXPR_END.length)
      continue
    }

    // Case 3: Start marker found - add text before it
    if (startIdx > 0) {
      parts.push(
        <span key={`${keyPrefix}-text-${keyIndex++}`}>
          {remaining.slice(0, startIdx)}
        </span>
      )
      remaining = remaining.slice(startIdx)
      continue
    }

    // Case 4: Start marker at beginning
    // Check if end marker is also in this text
    const contentStart = EXPR_START.length
    const localEndIdx = remaining.indexOf(EXPR_END, contentStart)

    if (localEndIdx !== -1) {
      // Complete expression in this text node
      const exprText = remaining.slice(contentStart, localEndIdx)
      const exprIdx = exprCounter.current

      if (expressions[exprIdx]) {
        const expr = expressions[exprIdx]
        const classes = getExpressionClasses(expr.type)
        const label = getExpressionLabel(expr.type)
        const tooltip = expr.original ? `${label}: ${expr.original}` : label

        parts.push(
          <span key={`${keyPrefix}-expr-${keyIndex++}`} className={classes} title={tooltip}>
            {exprText}
          </span>
        )
      } else {
        parts.push(
          <span key={`${keyPrefix}-text-${keyIndex++}`}>{exprText}</span>
        )
      }

      exprCounter.current++
      remaining = remaining.slice(localEndIdx + EXPR_END.length)
    } else {
      // Start marker but no end marker - expression continues in next element
      const exprText = remaining.slice(contentStart)
      const exprIdx = exprCounter.current

      if (exprText && expressions[exprIdx]) {
        const expr = expressions[exprIdx]
        const classes = getExpressionClasses(expr.type)
        const label = getExpressionLabel(expr.type)
        const tooltip = expr.original ? `${label}: ${expr.original}` : label

        parts.push(
          <span key={`${keyPrefix}-expr-${keyIndex++}`} className={classes} title={tooltip}>
            {exprText}
          </span>
        )
      } else if (exprText) {
        parts.push(
          <span key={`${keyPrefix}-text-${keyIndex++}`}>{exprText}</span>
        )
      }
      break
    }
  }

  return parts
}

/**
 * Process children recursively to handle expression markers.
 * Shares an expression counter across all children to handle markdown splits.
 */
function processChildren(
  children: ReactNode,
  expressions: ExpressionInfo[],
  keyPrefix: string,
  exprCounter: { current: number } = { current: 0 }
): ReactNode {
  if (typeof children === 'string') {
    const parsed = parseTextWithExpressions(children, expressions, keyPrefix, exprCounter)
    return parsed.length === 1 ? parsed[0] : <>{parsed}</>
  }

  if (Array.isArray(children)) {
    return children.map((child, idx) =>
      processChildren(child, expressions, `${keyPrefix}-${idx}`, exprCounter)
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
            // Override heading elements
            h1: ({ children }) => (
              <h1>{processChildren(children, expressions, 'h1')}</h1>
            ),
            h2: ({ children }) => (
              <h2>{processChildren(children, expressions, 'h2')}</h2>
            ),
            h3: ({ children }) => (
              <h3>{processChildren(children, expressions, 'h3')}</h3>
            ),
            h4: ({ children }) => (
              <h4>{processChildren(children, expressions, 'h4')}</h4>
            ),
            h5: ({ children }) => (
              <h5>{processChildren(children, expressions, 'h5')}</h5>
            ),
            h6: ({ children }) => (
              <h6>{processChildren(children, expressions, 'h6')}</h6>
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
              // Strip expression markers from code (just the zero-width characters)
              const markerRegex = new RegExp(
                `${EXPR_START}([\\s\\S]*?)${EXPR_END}`,
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
