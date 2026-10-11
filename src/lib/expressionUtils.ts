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
 * Options for expression type detection.
 */
export interface ExpressionTypeOptions {
  /** Set of template IDs to distinguish templates from tables */
  templateIds?: Set<string>
}

/**
 * Extract the base reference ID from an expression.
 * Handles patterns like "tableName", "3*tableName", "alias.tableName", "tableName.@prop"
 */
function extractReferenceId(content: string): string | null {
  const trimmed = content.trim()

  // Skip non-reference expressions
  if (trimmed.startsWith('dice:') || trimmed.startsWith('math:') ||
      trimmed.startsWith('collect:') || trimmed.startsWith('unique:') ||
      trimmed.startsWith('$') || trimmed.startsWith('@') ||
      trimmed.includes('switch[') || trimmed.includes(' >> ')) {
    return null
  }

  // Handle multi-roll: "3*tableName" or "3*unique*tableName"
  let ref = trimmed.replace(/^\d+\*(?:unique\*)?/, '')

  // Handle alias prefix: "alias.tableName" -> "tableName"
  if (ref.includes('.')) {
    const parts = ref.split('.')
    // If it's an alias reference (e.g., "core.weapons"), take the last part
    // But if it's a property access (e.g., "table.@prop"), stop at @
    const propIndex = parts.findIndex(p => p.startsWith('@'))
    if (propIndex > 0) {
      ref = parts[propIndex - 1]
    } else if (parts.length >= 2) {
      // For alias.table, use the last part as the reference
      ref = parts[parts.length - 1]
    }
  }

  // Handle instance syntax: "table#name" -> "table"
  ref = ref.replace(/#.*$/, '')

  return ref || null
}

/**
 * Determine expression type from raw expression string content.
 * This is the single source of truth for expression type detection.
 *
 * @param content - The expression content (without {{ }})
 * @param options - Optional settings like templateIds for template detection
 * @returns The detected expression type
 *
 * @example
 * getExpressionType('dice:3d6') // 'dice'
 * getExpressionType('math:@level*2') // 'math'
 * getExpressionType('heroName') // 'table'
 * getExpressionType('$varName') // 'variable'
 * getExpressionType('@prop') // 'placeholder'
 * getExpressionType('3*table >> $var') // 'capture'
 * getExpressionType('myTemplate', { templateIds: new Set(['myTemplate']) }) // 'template'
 */
export function getExpressionType(content: string, options?: ExpressionTypeOptions): ExpressionType {
  const trimmed = content.trim()

  // Switch expressions: switch[...] or expr.switch[...] or any expression containing switch[
  // Switch statements have branching paths and should always be highlighted in purple
  if (trimmed.includes('switch[')) {
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

  // Check if this is a template reference (requires templateIds)
  if (options?.templateIds) {
    const refId = extractReferenceId(trimmed)
    if (refId && options.templateIds.has(refId)) {
      return 'template'
    }
  }

  // Multi-roll pattern: {{3*tableName}} (already handled template check above)
  if (/^\d+\*/.test(trimmed)) {
    return 'table'
  }

  // Default for table references
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
