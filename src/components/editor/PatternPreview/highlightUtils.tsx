/**
 * Shared Highlighting Utilities
 *
 * Provides unified text highlighting logic for pattern input components.
 * Used by both EditablePattern (multi-line) and HighlightedInput (single-line).
 */

import type { ReactNode } from 'react'
import { extractExpressions } from '@/engine/core/parser'
import { cn } from '@/lib/utils'
import { EXPRESSION_COLORS, getExpressionType } from './expressionColors'

/**
 * Options for text highlighting
 */
export interface HighlightOptions {
  /** Whether to wrap text (for multi-line). Use 'pre' for single-line, 'pre-wrap' for multi-line */
  whiteSpace?: 'pre' | 'pre-wrap'
  /** Additional class name to apply to expression spans */
  expressionClassName?: string
}

/**
 * Get the color class for an expression based on its content
 */
export function getExpressionColorClass(content: string): string {
  const type = getExpressionType(content)
  return EXPRESSION_COLORS[type].text
}

/**
 * Render syntax-highlighted text with expression color coding.
 *
 * @param text - The text to highlight
 * @param options - Highlighting options
 * @returns React nodes with highlighted expressions
 */
export function renderHighlightedText(
  text: string,
  options: HighlightOptions = {}
): ReactNode {
  const { whiteSpace = 'pre-wrap', expressionClassName } = options

  const expressions = extractExpressions(text)
  const parts: ReactNode[] = []
  let lastIndex = 0

  const whitespaceClass = whiteSpace === 'pre' ? 'whitespace-pre' : 'whitespace-pre-wrap'

  for (const match of expressions) {
    // Add literal text before the expression
    if (match.start > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`} className={whitespaceClass}>
          {text.slice(lastIndex, match.start)}
        </span>
      )
    }

    // Add the highlighted expression
    const colorClass = getExpressionColorClass(match.expression)
    parts.push(
      <span
        key={`expr-${match.start}`}
        className={cn(colorClass, expressionClassName)}
      >
        {match.raw}
      </span>
    )

    lastIndex = match.end
  }

  // Add remaining literal text
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`} className={whitespaceClass}>
        {text.slice(lastIndex)}
      </span>
    )
  }

  return parts.length > 0 ? parts : text
}
