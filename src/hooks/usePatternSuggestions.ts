/**
 * usePatternSuggestions Hook
 *
 * Builds the suggestion list for pattern autocomplete from available
 * tables, templates, variables, and syntax helpers.
 */

import { useMemo } from 'react'
import {
  Table2,
  Sparkles,
  Dices,
  Calculator,
  Variable,
  RotateCcw,
  CircleDot,
  ArrowRightLeft,
  Layers,
  AtSign,
  type LucideIcon,
} from 'lucide-react'
import { getResultTypeIcon } from '@/lib/resultTypeIcons'
import type {
  TableInfo,
  TemplateInfo,
  ImportedTableInfo,
  ImportedTemplateInfo,
} from '@/engine/core'
import type { Table, SimpleTable, Template } from '@/engine/types'

/**
 * Category types for suggestions
 */
export type SuggestionCategory =
  | 'table'
  | 'template'
  | 'property'
  | 'variable'
  | 'placeholder'
  | 'syntax'

/**
 * Color class names for suggestion categories
 */
export type SuggestionColorClass =
  | 'mint'
  | 'lavender'
  | 'amber'
  | 'pink'
  | 'cyan'

/**
 * A single autocomplete suggestion
 */
export interface Suggestion {
  /** Unique identifier */
  id: string
  /** Display text (e.g., "heroName") */
  label: string
  /** What to insert after the trigger (e.g., "heroName" for {{heroName}}) */
  insertText: string
  /** Category for filtering and color coding */
  category: SuggestionCategory
  /** Optional description */
  description?: string
  /** Icon component */
  icon: LucideIcon
  /** Source collection name ("Local" or collection name) */
  source: string
  /** Color class for styling */
  colorClass: SuggestionColorClass
}

/**
 * Options for usePatternSuggestions
 */
export interface UsePatternSuggestionsOptions {
  /** Local tables in the current collection */
  localTables: TableInfo[]
  /** Local templates in the current collection */
  localTemplates: TemplateInfo[]
  /** Tables from imported collections */
  importedTables?: ImportedTableInfo[]
  /** Templates from imported collections */
  importedTemplates?: ImportedTemplateInfo[]
  /** Static variables from document.variables */
  variables?: Record<string, string>
  /** Shared variables from document.shared */
  sharedVariables?: Record<string, string>
  /** Available entry set property keys (for @ placeholders) */
  entrySetKeys?: string[]
  /** Full table data for property lookups (keyed by table ID) */
  tableMap?: Map<string, Table>
}

const LOCAL_SOURCE = 'Local'
const SYNTAX_SOURCE = 'Syntax'

/**
 * Syntax helper suggestions
 */
const SYNTAX_SUGGESTIONS: Suggestion[] = [
  {
    id: 'syntax-dice',
    label: 'dice:',
    insertText: 'dice:2d6',
    category: 'syntax',
    description: 'Roll dice (e.g., 2d6, 1d20+5, 4d6k3)',
    icon: Dices,
    source: SYNTAX_SOURCE,
    colorClass: 'amber',
  },
  {
    id: 'syntax-math',
    label: 'math:',
    insertText: 'math:1 + 2',
    category: 'syntax',
    description: 'Calculate math expression',
    icon: Calculator,
    source: SYNTAX_SOURCE,
    colorClass: 'amber',
  },
  {
    id: 'syntax-again',
    label: 'again',
    insertText: 'again',
    category: 'syntax',
    description: 'Re-roll the current table',
    icon: RotateCcw,
    source: SYNTAX_SOURCE,
    colorClass: 'amber',
  },
  {
    id: 'syntax-collect',
    label: 'collect:',
    insertText: 'collect:$var.@prop',
    category: 'syntax',
    description: 'Aggregate captured properties',
    icon: Layers,
    source: SYNTAX_SOURCE,
    colorClass: 'amber',
  },
  {
    id: 'syntax-switch',
    label: 'switch[',
    insertText: 'switch[$=="value":"result"].else["fallback"]',
    category: 'syntax',
    description: 'Conditional logic',
    icon: ArrowRightLeft,
    source: SYNTAX_SOURCE,
    colorClass: 'amber',
  },
]

/**
 * Build suggestion list from available data sources
 */
export function usePatternSuggestions(
  options: UsePatternSuggestionsOptions
): Suggestion[] {
  const {
    localTables,
    localTemplates,
    importedTables = [],
    importedTemplates = [],
    variables = {},
    sharedVariables = {},
    entrySetKeys = [],
  } = options

  return useMemo(() => {
    const suggestions: Suggestion[] = []

    // Local tables
    for (const table of localTables) {
      suggestions.push({
        id: `table-${table.id}`,
        label: table.id,
        insertText: table.id,
        category: 'table',
        description: table.name !== table.id ? table.name : table.description,
        icon: table.resultType ? getResultTypeIcon(table.resultType) : Table2,
        source: LOCAL_SOURCE,
        colorClass: 'mint',
      })
    }

    // Local templates
    for (const template of localTemplates) {
      suggestions.push({
        id: `template-${template.id}`,
        label: template.id,
        insertText: template.id,
        category: 'template',
        description:
          template.name !== template.id ? template.name : template.description,
        icon: template.resultType
          ? getResultTypeIcon(template.resultType)
          : Sparkles,
        source: LOCAL_SOURCE,
        colorClass: 'lavender',
      })
    }

    // Imported tables
    for (const table of importedTables) {
      const fullId = `${table.alias}.${table.id}`
      suggestions.push({
        id: `imported-table-${fullId}`,
        label: fullId,
        insertText: fullId,
        category: 'table',
        description: table.name !== table.id ? table.name : table.description,
        icon: table.resultType ? getResultTypeIcon(table.resultType) : Table2,
        source: table.sourceCollectionName,
        colorClass: 'mint',
      })
    }

    // Imported templates
    for (const template of importedTemplates) {
      const fullId = `${template.alias}.${template.id}`
      suggestions.push({
        id: `imported-template-${fullId}`,
        label: fullId,
        insertText: fullId,
        category: 'template',
        description:
          template.name !== template.id
            ? template.name
            : template.description,
        icon: template.resultType
          ? getResultTypeIcon(template.resultType)
          : Sparkles,
        source: template.sourceCollectionName,
        colorClass: 'lavender',
      })
    }

    // Static variables
    for (const varName of Object.keys(variables)) {
      suggestions.push({
        id: `variable-${varName}`,
        label: `$${varName}`,
        insertText: `$${varName}`,
        category: 'variable',
        description: `Static: "${variables[varName]}"`,
        icon: Variable,
        source: LOCAL_SOURCE,
        colorClass: 'pink',
      })
    }

    // Shared variables
    for (const varName of Object.keys(sharedVariables)) {
      suggestions.push({
        id: `shared-${varName}`,
        label: `$${varName}`,
        insertText: `$${varName}`,
        category: 'variable',
        description: `Shared: ${sharedVariables[varName]}`,
        icon: CircleDot,
        source: LOCAL_SOURCE,
        colorClass: 'pink',
      })
    }

    // Entry set placeholders
    for (const key of entrySetKeys) {
      suggestions.push({
        id: `placeholder-${key}`,
        label: `@${key}`,
        insertText: `@${key}`,
        category: 'placeholder',
        description: 'Entry set property',
        icon: AtSign,
        source: LOCAL_SOURCE,
        colorClass: 'cyan',
      })
    }

    // Syntax helpers
    suggestions.push(...SYNTAX_SUGGESTIONS)

    return suggestions
  }, [
    localTables,
    localTemplates,
    importedTables,
    importedTemplates,
    variables,
    sharedVariables,
    entrySetKeys,
  ])
}

/**
 * Check if a table is a simple table (has entries with sets)
 */
function isSimpleTable(table: Table): table is SimpleTable {
  return table.type === 'simple' || !table.type
}

/**
 * Extract all available property keys from a table
 * Looks at defaultSets and all entry.sets to find all possible properties
 */
export function getTableProperties(table: Table): string[] {
  const properties = new Set<string>(['value', 'description']) // Always available

  if (isSimpleTable(table)) {
    // Add default sets keys
    if (table.defaultSets) {
      Object.keys(table.defaultSets).forEach(k => properties.add(k))
    }

    // Add all entry sets keys
    if (table.entries) {
      for (const entry of table.entries) {
        if (entry.sets) {
          Object.keys(entry.sets).forEach(k => properties.add(k))
        }
      }
    }
  }

  return Array.from(properties).sort()
}

/**
 * Extract all available property keys from a template
 * Looks at template.shared to find available variables
 */
export function getTemplateProperties(template: Template): string[] {
  const properties = new Set<string>(['value']) // Always available (the template output)

  // Add shared variable keys
  if (template.shared) {
    Object.keys(template.shared).forEach(k => {
      // Remove $ prefix if present for display
      const propName = k.startsWith('$') ? k.slice(1) : k
      properties.add(propName)
    })
  }

  return Array.from(properties).sort()
}

/**
 * Extract table reference from a pattern like "{{tableName}}" or "{{alias.tableName}}"
 * Returns the table ID or null if not a simple table reference
 */
function extractTableReference(pattern: string): string | null {
  // Match simple table references: {{tableName}} or {{alias.tableName}}
  const match = pattern.match(/^\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}$/)
  if (match) {
    const ref = match[1]
    // If it contains a dot, take the last part as the table ID
    const parts = ref.split('.')
    return parts[parts.length - 1]
  }
  return null
}

/**
 * Get the property value from a table's defaultSets or first entry's sets
 */
function getPropertyValue(table: Table, propName: string): string | null {
  if (!isSimpleTable(table)) return null

  // Check defaultSets first
  if (table.defaultSets && table.defaultSets[propName]) {
    return table.defaultSets[propName]
  }

  // Check first entry's sets as fallback
  if (table.entries) {
    for (const entry of table.entries) {
      if (entry.sets && entry.sets[propName]) {
        return entry.sets[propName]
      }
    }
  }

  return null
}

/**
 * Get the property value from a template's shared variables
 */
function getTemplatePropertyValue(template: Template, propName: string): string | null {
  if (!template.shared) return null

  // Check with and without $ prefix
  const value = template.shared[propName] || template.shared[`$${propName}`]
  return value || null
}

/**
 * Build property suggestions for a specific table or template
 * Supports recursive property chains like tableName.@prop1.@prop2
 */
function buildPropertySuggestions(
  tableMap: Map<string, Table> | undefined,
  templateMap: Map<string, Template> | undefined,
  targetId: string,
  propertyChain: string[] = []
): Suggestion[] {
  // If we have a property chain, we need to traverse it to find the final target
  if (propertyChain.length > 0) {
    return buildNestedPropertySuggestions(tableMap, templateMap, targetId, propertyChain)
  }

  // No property chain - show properties of the target directly
  // First try to find as a table
  if (tableMap) {
    const table = tableMap.get(targetId)
    if (table) {
      const properties = getTableProperties(table)
      return properties.map(prop => ({
        id: `property-${targetId}-${prop}`,
        label: prop,
        insertText: prop,
        category: 'property' as const,
        description: prop === 'value'
          ? 'The entry\'s output text'
          : prop === 'description'
          ? 'The entry\'s description'
          : `Property from ${targetId}`,
        icon: AtSign,
        source: targetId,
        colorClass: 'cyan' as const,
      }))
    }
  }

  // Then try to find as a template
  if (templateMap) {
    const template = templateMap.get(targetId)
    if (template) {
      const properties = getTemplateProperties(template)
      return properties.map(prop => ({
        id: `property-${targetId}-${prop}`,
        label: prop,
        insertText: prop,
        category: 'property' as const,
        description: prop === 'value'
          ? 'The template\'s output text'
          : `Shared variable from ${targetId}`,
        icon: AtSign,
        source: targetId,
        colorClass: 'cyan' as const,
      }))
    }
  }

  return []
}

/**
 * Build suggestions for nested property access (e.g., tableName.@prop1.@prop2.)
 * Traverses the property chain to find what table/template the final property refers to
 */
function buildNestedPropertySuggestions(
  tableMap: Map<string, Table> | undefined,
  templateMap: Map<string, Template> | undefined,
  targetId: string,
  propertyChain: string[]
): Suggestion[] {
  if (!tableMap && !templateMap) return []

  // Start with the target table/template
  let currentTable = tableMap?.get(targetId)
  let currentTemplate = !currentTable ? templateMap?.get(targetId) : undefined

  if (!currentTable && !currentTemplate) return []

  // Traverse each property in the chain
  for (const prop of propertyChain) {
    let propValue: string | null = null

    if (currentTable) {
      propValue = getPropertyValue(currentTable, prop)
    } else if (currentTemplate) {
      propValue = getTemplatePropertyValue(currentTemplate, prop)
    }

    if (!propValue) {
      // Property not found or doesn't have a value we can analyze
      return []
    }

    // Try to extract a table reference from the property value
    const tableRef = extractTableReference(propValue)
    if (!tableRef) {
      // Property doesn't reference another table - can't drill deeper
      return []
    }

    // Look up the referenced table
    currentTable = tableMap?.get(tableRef)
    currentTemplate = !currentTable ? templateMap?.get(tableRef) : undefined

    if (!currentTable && !currentTemplate) {
      // Referenced table/template not found
      return []
    }
  }

  // We've traversed the chain - now return properties of the final table/template
  const chainPath = `${targetId}.@${propertyChain.join('.@')}`

  if (currentTable) {
    const properties = getTableProperties(currentTable)
    return properties.map(prop => ({
      id: `property-${chainPath}-${prop}`,
      label: prop,
      insertText: prop,
      category: 'property' as const,
      description: prop === 'value'
        ? 'The entry\'s output text'
        : prop === 'description'
        ? 'The entry\'s description'
        : `Property from ${currentTable!.id}`,
      icon: AtSign,
      source: currentTable!.id,
      colorClass: 'cyan' as const,
    }))
  }

  if (currentTemplate) {
    const properties = getTemplateProperties(currentTemplate)
    return properties.map(prop => ({
      id: `property-${chainPath}-${prop}`,
      label: prop,
      insertText: prop,
      category: 'property' as const,
      description: prop === 'value'
        ? 'The template\'s output text'
        : `Shared variable from ${currentTemplate!.id}`,
      icon: AtSign,
      source: currentTemplate!.id,
      colorClass: 'cyan' as const,
    }))
  }

  return []
}

/**
 * Options for filterSuggestions
 */
export interface FilterSuggestionsOptions {
  /** For 'property' trigger: map of table ID to full table data */
  tableMap?: Map<string, Table>
  /** For 'property' trigger: map of template ID to full template data */
  templateMap?: Map<string, Template>
  /** For 'property' trigger: the target table/template ID */
  targetId?: string
  /** For 'property' trigger: the property chain so far */
  propertyChain?: string[]
}

/**
 * Filter suggestions based on trigger type and partial input
 */
export function filterSuggestions(
  suggestions: Suggestion[],
  triggerType: 'braces' | 'variable' | 'placeholder' | 'property',
  partialInput: string,
  options: FilterSuggestionsOptions = {}
): Suggestion[] {
  // First filter by trigger type
  let filtered: Suggestion[]

  switch (triggerType) {
    case 'variable':
      // Only show variables
      filtered = suggestions.filter((s) => s.category === 'variable')
      break
    case 'placeholder':
      // Only show placeholders
      filtered = suggestions.filter((s) => s.category === 'placeholder')
      break
    case 'property':
      // Build property suggestions for the target table or template
      if (options.targetId) {
        filtered = buildPropertySuggestions(
          options.tableMap,
          options.templateMap,
          options.targetId,
          options.propertyChain
        )
      } else {
        filtered = []
      }
      break
    case 'braces':
    default:
      // Show all suggestions
      filtered = suggestions
      break
  }

  // Then filter by partial input if present
  if (partialInput.trim()) {
    const query = partialInput.toLowerCase()
    filtered = filtered.filter(
      (s) =>
        s.label.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.source.toLowerCase().includes(query)
    )
  }

  return filtered
}
