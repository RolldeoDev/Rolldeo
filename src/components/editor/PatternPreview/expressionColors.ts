/**
 * Centralized color definitions for expression syntax highlighting.
 * Used by both EditablePattern (input) and InlineResult (preview).
 *
 * Color Scheme:
 * - dice: amber
 * - math: orange (darker amber)
 * - table: mint
 * - template: lavender
 * - variable: pink (light)
 * - placeholder: teal (cyan)
 * - again: mint (green)
 * - unique: amber
 * - capture: pink (light)
 * - capture-shared: pink (light)
 * - collect: blue
 * - switch: purple (control flow)
 * - unknown: gray
 */

import type { ExpressionType } from './types'

/**
 * Color configuration for each expression type
 */
export const EXPRESSION_COLORS: Record<
  ExpressionType,
  {
    /** Text color class (for pattern input overlay) */
    text: string
    /** Full classes with background (for preview badges) */
    badge: string
  }
> = {
  dice: {
    text: 'text-amber',
    badge: 'bg-amber/15 text-amber hover:bg-amber/25',
  },
  math: {
    text: 'text-orange',
    badge: 'bg-orange/15 text-orange hover:bg-orange/25',
  },
  table: {
    text: 'text-mint',
    badge: 'bg-mint/15 text-mint hover:bg-mint/25',
  },
  template: {
    text: 'text-lavender',
    badge: 'bg-lavender/15 text-lavender hover:bg-lavender/25',
  },
  variable: {
    text: 'text-pink-400 dark:text-pink-300',
    badge: 'bg-pink-400/15 text-pink-400 dark:text-pink-300 hover:bg-pink-400/25',
  },
  placeholder: {
    text: 'text-cyan',
    badge: 'bg-cyan/15 text-cyan hover:bg-cyan/25',
  },
  again: {
    text: 'text-mint',
    badge: 'bg-mint/15 text-mint hover:bg-mint/25',
  },
  unique: {
    text: 'text-amber',
    badge: 'bg-amber/15 text-amber hover:bg-amber/25',
  },
  capture: {
    text: 'text-pink-400 dark:text-pink-300',
    badge: 'bg-pink-400/15 text-pink-400 dark:text-pink-300 hover:bg-pink-400/25',
  },
  'capture-shared': {
    text: 'text-pink-400 dark:text-pink-300',
    badge: 'bg-pink-400/15 text-pink-400 dark:text-pink-300 hover:bg-pink-400/25',
  },
  collect: {
    text: 'text-blue-500 dark:text-blue-400',
    badge: 'bg-blue-500/15 text-blue-500 dark:text-blue-400 hover:bg-blue-500/25',
  },
  switch: {
    text: 'text-purple-500 dark:text-purple-400',
    badge: 'bg-purple-500/15 text-purple-500 dark:text-purple-400 hover:bg-purple-500/25',
  },
  unknown: {
    text: 'text-gray-500 dark:text-gray-400',
    badge: 'bg-gray-500/15 text-gray-600 dark:text-gray-400 hover:bg-gray-500/25',
  },
}

/**
 * Get text color class for pattern input highlighting
 */
export function getExpressionTextColor(type: ExpressionType): string {
  return EXPRESSION_COLORS[type].text
}

/**
 * Get badge classes for preview highlighting
 */
export function getExpressionBadgeClasses(type: ExpressionType): string {
  return EXPRESSION_COLORS[type].badge
}

/**
 * Determine expression type from raw expression string content.
 * Used by EditablePattern for syntax highlighting in the pattern input.
 */
export function getExpressionTypeFromContent(content: string): ExpressionType {
  // Dice expressions: {{dice:XdY}}
  if (content.startsWith('dice:')) return 'dice'

  // Math expressions: {{math:expr}}
  if (content.startsWith('math:')) return 'math'

  // Collect expressions: {{collect:$var.@prop}}
  if (content.startsWith('collect:')) return 'collect'

  // Roll capture: {{N*table >> $var}}
  if (content.includes(' >> $') || content.includes('>>$')) return 'capture'

  // Capture-aware shared variable with property access: $var.@prop, $var[n].@prop
  if (content.startsWith('$') && content.includes('@')) return 'capture-shared'

  // Regular variable access: $var, $var[n], $var.value, $var.count
  if (content.startsWith('$')) return 'variable'

  // Placeholder access: @placeholder
  if (content.startsWith('@')) return 'placeholder'

  // Roll again: {{again}}, {{N*again}}
  if (content === 'again' || content.endsWith('*again')) return 'again'

  // Unique modifier: {{unique:...}}
  if (content.startsWith('unique:')) return 'unique'

  // Switch expressions: {{switch[...]}} or {{expr.switch[...]}}
  if (content.startsWith('switch[') || content.includes('.switch[')) return 'switch'

  // Default for table references (can't easily distinguish from templates here)
  return 'table'
}
