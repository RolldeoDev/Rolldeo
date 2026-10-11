/**
 * InlineResult Component
 *
 * Displays evaluated pattern with Markdown support and inline highlighting
 * of expression results. Each expression segment shows its evaluated value
 * with colored background and tooltip showing the original {{...}} syntax.
 */

import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import type { Root, RootContent, Text } from 'hast'
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

interface ExpressionSpan {
  start: number
  end: number
  segment: EvaluatedSegment
}

/** Attribute the parsed Markdown using source positions, never synthetic text.
 * Formatting, links and paragraphs may divide a result across several AST nodes.
 */
function buildMarkdownSource(segments: EvaluatedSegment[]) {
  const spans: ExpressionSpan[] = []
  let text = ''
  for (const segment of segments) {
    const start = text.length
    text += segment.text
    if (segment.type === 'expression') spans.push({ start, end: text.length, segment })
  }
  return { text, spans }
}

const textDecoder = unified().use(remarkParse)

// Markdown text positions include entity/escape syntax removed from the visible
// text. Decode a prefix only for those leaves; ordinary text needs no extra parse.
function visiblePrefixLength(source: string): number {
  const tree = textDecoder.parse(source)
  function length(node: { type: string; value?: string; children?: typeof tree.children }): number {
    if (node.type === 'text') return node.value?.length ?? 0
    return node.children?.reduce((sum, child) => sum + length(child), 0) ?? 0
  }
  return length(tree)
}

function expressionTextNode(text: string, span: ExpressionSpan): RootContent {
  const type = span.segment.expressionType ?? 'unknown'
  const label = getExpressionLabel(type)
  return {
    type: 'element', tagName: 'span',
    properties: {
      className: getExpressionClasses(type).split(' '),
      title: span.segment.originalExpression ? `${label}: ${span.segment.originalExpression}` : label,
    },
    children: [{ type: 'text', value: text }],
  }
}

function annotateMarkdown(source: string, spans: ExpressionSpan[]) {
  return function plugin() {
    return function transform(tree: Root) {
      function highlight(node: Text): RootContent[] {
        const start = node.position?.start.offset
        const end = node.position?.end.offset
        if (start === undefined || end === undefined) return [node]
        const intersections = spans.filter(span => span.start < end && span.end > start)
        if (intersections.length === 0) return [node]
        const raw = source.slice(start, end)
        const offset = (sourceOffset: number) => raw === node.value
          ? sourceOffset - start
          : Math.min(node.value.length, visiblePrefixLength(source.slice(start, sourceOffset)))
        const parts: RootContent[] = []
        let last = 0
        for (const span of intersections) {
          const left = offset(Math.max(start, span.start))
          const right = offset(Math.min(end, span.end))
          if (left > last) parts.push({ type: 'text', value: node.value.slice(last, left) })
          if (right > left) parts.push(expressionTextNode(node.value.slice(left, right), span))
          last = right
        }
        if (last < node.value.length) parts.push({ type: 'text', value: node.value.slice(last) })
        return parts
      }
      function visit(parent: Root | Extract<RootContent, { type: 'element' }>) {
        parent.children = parent.children.flatMap(node => {
          if (node.type === 'text') return highlight(node)
          if (node.type === 'element') {
            // Code/image text lacks leaf positions after Markdown conversion.
            // Attribute the element when the complete source belongs to one result.
            if (node.tagName === 'code' || node.tagName === 'img') {
              const start = node.position?.start.offset
              const end = node.position?.end.offset
              const span = start === undefined || end === undefined ? undefined
                : spans.find(candidate => candidate.start <= start && candidate.end >= end)
              if (span) {
                const type = span.segment.expressionType ?? 'unknown'
                const label = getExpressionLabel(type)
                node.properties.className = [node.properties.className ?? '', getExpressionClasses(type)].flat().join(' ')
                node.properties.title = span.segment.originalExpression ? `${label}: ${span.segment.originalExpression}` : label
              }
            }
            visit(node)
          }
          return [node]
        }) as typeof parent.children
      }
      visit(tree)
    }
  }
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
  const { text, spans } = useMemo(
    () => buildMarkdownSource(segments),
    [segments]
  )

  // Check if content has any markdown syntax
  const hasMarkdownSyntax = useMemo(() => {
    const plainText = segments.map((s) => s.text).join('')
    // Simple heuristic: check for common markdown patterns
    return /[*_#`[\]|>-]|\n/.test(plainText)
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
          rehypePlugins={[annotateMarkdown(text, spans)]}
        >
          {text}
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
