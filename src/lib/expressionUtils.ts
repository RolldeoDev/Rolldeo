/**
 * Expression Utilities
 *
 * Unified utilities for expression type detection and handling.
 * Single source of truth for determining expression types from content strings.
 */

/**
 * Expression types for color coding and categorization
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
 * Determine expression type from raw expression string content.
 * This is the single source of truth for expression type detection.
 *
 * @param content - The expression content (without {{ }})
 * @returns The detected expression type
 *
 * @example
 * getExpressionType('dice:3d6') // 'dice'
 * getExpressionType('math:@level*2') // 'math'
 * getExpressionType('heroName') // 'table'
 * getExpressionType('$varName') // 'variable'
 * getExpressionType('@prop') // 'placeholder'
 * getExpressionType('3*table >> $var') // 'capture'
 */
export function getExpressionType(content: string): ExpressionType {
  const trimmed = content.trim()

  // Switch expressions: switch[...] or expr.switch[...]
  if (trimmed.startsWith('switch[') || trimmed.includes('.switch[')) {
    return 'switch'
  }

  // Dice expressions: {{dice:XdY}}
  if (trimmed.startsWith('dice:')) {
    return 'dice'
  }

  // Math expressions: {{math:expr}}
  if (trimmed.startsWith('math:')) {
    return 'math'
  }

  // Collect expressions: {{collect:$var.@prop}}
  if (trimmed.startsWith('collect:')) {
    return 'collect'
  }

  // Roll capture: {{N*table >> $var}}
  if (trimmed.includes(' >> $') || trimmed.includes('>>$')) {
    return 'capture'
  }

  // Capture-aware shared variable with property access: $var.@prop, $var[n].@prop
  if (trimmed.startsWith('$') && trimmed.includes('@')) {
    return 'capture-shared'
  }

  // Regular variable access: $var, $var[n], $var.value, $var.count
  if (trimmed.startsWith('$')) {
    return 'variable'
  }

  // Placeholder access: @placeholder
  if (trimmed.startsWith('@')) {
    return 'placeholder'
  }

  // Roll again: {{again}}, {{N*again}}
  if (trimmed === 'again' || trimmed.endsWith('*again')) {
    return 'again'
  }

  // Unique modifier: {{unique:...}}
  if (trimmed.startsWith('unique:')) {
    return 'unique'
  }

  // Multi-roll pattern: {{3*tableName}}
  if (/^\d+\*/.test(trimmed)) {
    return 'table'
  }

  // Default for table references (can't easily distinguish from templates here)
  return 'table'
}

/**
 * Get a human-readable label for an expression type.
 *
 * @param type - The expression type
 * @returns Human-readable label
 */
export function getExpressionLabel(type: ExpressionType): string {
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
