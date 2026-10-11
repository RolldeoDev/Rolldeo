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
 * - placeholder: cyan (teal) - used for @prop access
 * - again: mint (green)
 * - unique: amber
 * - capture: pink (light) - used for {{N*table >> $var}}
 * - capture-shared: cyan (teal) - used for $var.@prop (accessing @ properties on variables)
 * - collect: blue
 * - switch: purple (control flow)
 * - unknown: gray
 */

import type { ExpressionType } from '@/lib/expressionUtils'
// Re-export getExpressionType for convenience
export { getExpressionType } from '@/lib/expressionUtils'

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
    text: 'text-pink',
    badge: 'bg-pink/15 text-pink hover:bg-pink/25',
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
    text: 'text-pink',
    badge: 'bg-pink/15 text-pink hover:bg-pink/25',
  },
  'capture-shared': {
    text: 'text-cyan',
    badge: 'bg-cyan/15 text-cyan hover:bg-cyan/25',
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
