/**
 * KeyValueEditor Component
 *
 * Reusable editor for key-value pairs with validation support.
 * Used for variables, shared variables, and other key-value data.
 */

import { useState, useCallback, useRef, useMemo, memo } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { usePatternEvaluation } from './PatternPreview/usePatternEvaluation'
import { HighlightedInput, type HighlightedInputRef } from './PatternPreview/HighlightedInput'
import { InsertDropdown } from './InsertDropdown'
import { cn } from '@/lib/utils'
import { parseTemplate } from '@/engine/core/parser'
import type { TableInfo, TemplateInfo, ImportedTableInfo, ImportedTemplateInfo } from '@/engine/core'
import type { Suggestion } from '@/hooks/usePatternSuggestions'
import type { Table, Template } from '@/engine/types'

/**
 * Reference types for smart variable highlighting.
 * Each type corresponds to a distinct border color for the key input.
 */
export type VariableRefType =
  | 'template'   // Lavender - references a template
  | 'table'      // Green - references a table
  | 'variable'   // Pink - references another variable
  | 'dice'       // Amber/Orange - dice or math expression
  | 'property'   // Cyan - property/set placeholder (static text)
  | 'switch'     // Purple - switch statement with branching paths
  | 'mixed'      // Multiple expression types
  | 'none'       // No expression detected

/**
 * Analyze a string value to determine what type of reference it contains.
 * Used recursively to check property values.
 */
function analyzeValueType(
  value: string,
  templateIds: Set<string>,
  tableIds: Set<string>,
  _tableMap?: Map<string, Table>,
  _templateMap?: Map<string, Template>,
  _sharedVariables?: Record<string, string>
): VariableRefType {
  if (!value || !value.includes('{{')) return 'property' // Static text = property (cyan)

  try {
    const tokens = parseTemplate(value)
    const types = new Set<VariableRefType>()

    for (const token of tokens) {
      if (token.type === 'literal') continue

      switch (token.type) {
        case 'table':
        case 'multiRoll':
        case 'captureMultiRoll':
        case 'instance':
          const tableId = token.tableId
          if (templateIds.has(tableId)) {
            types.add('template')
          } else if (tableIds.has(tableId)) {
            types.add('table')
          } else {
            types.add('table')
          }
          break

        case 'variable':
        case 'captureAccess':
        case 'collect':
          types.add('variable')
          break

        case 'dice':
        case 'math':
          types.add('dice')
          break

        case 'placeholder':
          types.add('property')
          break

        case 'switch':
          types.add('switch')
          break

        case 'again':
          types.add('table')
          break
      }
    }

    types.delete('none')

    if (types.size === 0) return 'property' // No expressions = static text
    if (types.size === 1) return Array.from(types)[0]
    // If switch is present, prioritize it since it has branching paths
    if (types.has('switch')) return 'switch'
    return 'mixed'
  } catch {
    return 'property' // Parse error = treat as static text
  }
}

/**
 * Look up a property value from a table's defaultSets or entry sets.
 */
function lookupTableProperty(
  tableId: string,
  propertyName: string,
  tableMap?: Map<string, Table>
): string | undefined {
  if (!tableMap) return undefined
  const table = tableMap.get(tableId)
  if (!table) return undefined

  // Check defaultSets first
  if (table.defaultSets && propertyName in table.defaultSets) {
    return table.defaultSets[propertyName]
  }

  // Check first entry's sets as a representative sample
  if (table.type === 'simple' && table.entries.length > 0) {
    const firstEntry = table.entries[0]
    if (firstEntry.sets && propertyName in firstEntry.sets) {
      return firstEntry.sets[propertyName]
    }
  }

  return undefined
}

/**
 * Look up a property value from a shared variable that references a table.
 */
function lookupVariableProperty(
  varName: string,
  propertyName: string,
  sharedVariables?: Record<string, string>,
  tableMap?: Map<string, Table>,
  _templateMap?: Map<string, Template>
): string | undefined {
  if (!sharedVariables) return undefined

  // Get the variable value (e.g., "{{gender}}")
  const varValue = sharedVariables[varName] || sharedVariables[varName.replace(/^\$/, '')]
  if (!varValue) return undefined

  // Parse to find what table it references
  try {
    const tokens = parseTemplate(varValue)
    for (const token of tokens) {
      if (token.type === 'table' || token.type === 'instance') {
        // Found a table reference - look up the property in that table
        return lookupTableProperty(token.tableId, propertyName, tableMap)
      }
    }
  } catch {
    // Parse error
  }

  return undefined
}

/**
 * Analyze a variable value to determine what type of reference it contains.
 * Returns the primary reference type for border coloring.
 *
 * This function now deeply inspects property accesses like {{table.@prop}}
 * to determine what the property value actually contains.
 */
function getVariableRefType(
  value: string,
  templateIds: Set<string>,
  tableIds: Set<string>,
  _variableNames: Set<string>,
  tableMap?: Map<string, Table>,
  templateMap?: Map<string, Template>,
  sharedVariables?: Record<string, string>
): VariableRefType {
  if (!value || !value.includes('{{')) return 'none'

  try {
    const tokens = parseTemplate(value)
    const types = new Set<VariableRefType>()

    for (const token of tokens) {
      if (token.type === 'literal') continue

      switch (token.type) {
        case 'table':
        case 'multiRoll':
        case 'captureMultiRoll':
        case 'instance': {
          const tableId = token.tableId

          // Check if this has a property access (e.g., {{table.@prop}})
          // The parser puts the property in a separate placeholder token after
          // But for patterns like {{gender.@possessive}}, we need to check the raw value
          const propMatch = value.match(new RegExp(`\\{\\{${tableId}\\.@(\\w+)\\}\\}`))
          if (propMatch) {
            const propName = propMatch[1]
            const propValue = lookupTableProperty(tableId, propName, tableMap)
            if (propValue !== undefined) {
              // Analyze what the property value contains
              const propType = analyzeValueType(propValue, templateIds, tableIds, tableMap, templateMap, sharedVariables)
              types.add(propType)
              break
            }
          }

          // No property access or couldn't resolve - classify as table/template
          if (templateIds.has(tableId)) {
            types.add('template')
          } else if (tableIds.has(tableId)) {
            types.add('table')
          } else {
            types.add('table')
          }
          break
        }

        case 'variable': {
          // Check for property access on variable (e.g., {{$hero.@name}})
          const varName = token.name
          const varPropMatch = value.match(new RegExp(`\\{\\{\\$${varName}\\.@(\\w+)\\}\\}`))
          if (varPropMatch) {
            const propName = varPropMatch[1]
            const propValue = lookupVariableProperty(varName, propName, sharedVariables, tableMap, templateMap)
            if (propValue !== undefined) {
              const propType = analyzeValueType(propValue, templateIds, tableIds, tableMap, templateMap, sharedVariables)
              types.add(propType)
              break
            }
          }
          types.add('variable')
          break
        }

        case 'captureAccess': {
          // Check for property access (e.g., {{$items[0].@name}})
          // For now, treat as variable since we can't easily resolve capture contents
          types.add('variable')
          break
        }

        case 'collect':
          types.add('variable')
          break

        case 'dice':
        case 'math':
          types.add('dice')
          break

        case 'placeholder':
          types.add('property')
          break

        case 'switch':
          types.add('switch')
          break

        case 'again':
          types.add('table')
          break
      }
    }

    types.delete('none')

    if (types.size === 0) return 'none'
    if (types.size === 1) return Array.from(types)[0]
    // If switch is present, prioritize it since it has branching paths
    if (types.has('switch')) return 'switch'
    return 'mixed'
  } catch {
    return 'none'
  }
}

/**
 * Color values for each reference type.
 * Used for both border and focus ring colors.
 */
const REF_TYPE_COLORS: Record<VariableRefType, string | null> = {
  template: 'hsl(var(--lavender))',
  table: 'hsl(var(--mint))',
  variable: 'hsl(var(--pink))',
  dice: 'hsl(var(--amber))',
  property: 'hsl(var(--cyan))',
  switch: 'rgb(168, 85, 247)', // Purple (purple-500) for branching paths
  mixed: 'hsl(var(--copper))',
  none: null,
}

/**
 * Get the inline style for the border and focus color based on reference type.
 * Using inline styles because Tailwind JIT doesn't generate dynamic arbitrary values.
 * Sets --focus-color CSS custom property for focus ring styling.
 */
function getRefTypeBorderStyle(refType: VariableRefType): React.CSSProperties {
  const color = REF_TYPE_COLORS[refType]
  if (!color) return {}

  return {
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    borderLeftColor: color,
    // Set CSS custom property for focus ring color
    '--focus-color': color,
  } as React.CSSProperties
}

export interface KeyValueEditorProps {
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  keyPattern?: string
  keyError?: string
  valueSupportsExpressions?: boolean
  /** Collection ID for evaluating expressions */
  collectionId?: string
  /** Show insert button for adding table/template references */
  showInsertButton?: boolean
  /** Local tables for insert dropdown */
  localTables?: TableInfo[]
  /** Local templates for insert dropdown */
  localTemplates?: TemplateInfo[]
  /** Imported tables for insert dropdown */
  importedTables?: ImportedTableInfo[]
  /** Imported templates for insert dropdown */
  importedTemplates?: ImportedTemplateInfo[]
  /** Suggestions for autocomplete */
  suggestions?: Suggestion[]
  /** Full table data for property lookups */
  tableMap?: Map<string, Table>
  /** Full template data for property lookups */
  templateMap?: Map<string, Template>
  /** Shared variables for variable property lookups */
  sharedVariables?: Record<string, string>
}

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  keyPattern,
  keyError,
  valueSupportsExpressions,
  collectionId,
  showInsertButton,
  localTables = [],
  localTemplates = [],
  importedTables = [],
  importedTemplates = [],
  suggestions,
  tableMap,
  templateMap,
  sharedVariables,
}: KeyValueEditorProps) {
  const entries = Object.entries(value)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [keyValidationError, setKeyValidationError] = useState<string | null>(null)
  const newKeyInputRef = useRef<HTMLInputElement>(null)
  const newValueInputRef = useRef<HighlightedInputRef>(null)

  // Track which entry is being edited and its local state
  const [editingKeyIndex, setEditingKeyIndex] = useState<number | null>(null)
  const [editingKeyValue, setEditingKeyValue] = useState('')

  // Track focus state for value inputs (to show insert button)
  const [focusedValueIndex, setFocusedValueIndex] = useState<number | null>(null)
  const [newValueFocused, setNewValueFocused] = useState(false)

  // Track which dropdown is open (to keep button visible while dropdown is open)
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null)
  const [newValueDropdownOpen, setNewValueDropdownOpen] = useState(false)

  // Refs for existing value inputs (to handle inserts)
  const valueInputRefs = useRef<Map<number, HighlightedInputRef>>(new Map())

  // Check if insert button should be available
  const hasInsertData = showInsertButton && (
    localTables.length > 0 ||
    localTemplates.length > 0 ||
    importedTables.length > 0 ||
    importedTemplates.length > 0
  )

  // Build lookup sets for smart variable highlighting
  const templateIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of localTemplates) ids.add(t.id)
    for (const t of importedTemplates) ids.add(t.id)
    return ids
  }, [localTemplates, importedTemplates])

  const tableIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of localTables) ids.add(t.id)
    for (const t of importedTables) ids.add(t.id)
    return ids
  }, [localTables, importedTables])

  const variableNames = useMemo(() => {
    const names = new Set<string>()
    for (const key of Object.keys(value)) names.add(key)
    if (sharedVariables) {
      for (const key of Object.keys(sharedVariables)) names.add(key)
    }
    return names
  }, [value, sharedVariables])

  // Compute reference types for all entries (for smart key highlighting)
  const refTypes = useMemo(() => {
    const types: Record<string, VariableRefType> = {}
    for (const [key, val] of Object.entries(value)) {
      types[key] = getVariableRefType(val, templateIds, tableIds, variableNames, tableMap, templateMap, sharedVariables)
    }
    return types
  }, [value, templateIds, tableIds, variableNames, tableMap, templateMap, sharedVariables])

  const validateKey = useCallback(
    (key: string): boolean => {
      if (!keyPattern) return true
      const regex = new RegExp(keyPattern)
      return regex.test(key)
    },
    [keyPattern]
  )

  const addEntry = useCallback(() => {
    const trimmedKey = newKey.trim()
    if (!trimmedKey) return

    if (!validateKey(trimmedKey)) {
      setKeyValidationError(keyError || 'Invalid key format')
      return
    }

    if (value[trimmedKey] !== undefined) {
      setKeyValidationError('Key already exists')
      return
    }

    onChange({ ...value, [trimmedKey]: newValue })
    setNewKey('')
    setNewValue('')
    setKeyValidationError(null)
    // Focus the new key input after adding
    setTimeout(() => newKeyInputRef.current?.focus(), 0)
  }, [value, onChange, newKey, newValue, validateKey, keyError])

  const removeEntry = useCallback(
    (key: string) => {
      const updated = { ...value }
      delete updated[key]
      onChange(updated)
    },
    [value, onChange]
  )

  const updateEntryValue = useCallback(
    (key: string, newValue: string) => {
      onChange({ ...value, [key]: newValue })
    },
    [value, onChange]
  )

  const commitKeyEdit = useCallback(
    (_index: number, oldKey: string, newKey: string) => {
      const trimmedKey = newKey.trim()

      // Reset editing state
      setEditingKeyIndex(null)
      setEditingKeyValue('')

      // If empty or unchanged, don't update
      if (!trimmedKey || trimmedKey === oldKey) return

      if (!validateKey(trimmedKey)) return
      if (value[trimmedKey] !== undefined) return

      const updated: Record<string, string> = {}
      for (const [k, v] of Object.entries(value)) {
        if (k === oldKey) {
          updated[trimmedKey] = v
        } else {
          updated[k] = v
        }
      }
      onChange(updated)
    },
    [value, onChange, validateKey]
  )

  const startKeyEdit = useCallback((index: number, currentKey: string) => {
    setEditingKeyIndex(index)
    setEditingKeyValue(currentKey)
  }, [])

  // Insert text into existing entry value at cursor position
  const handleInsertExisting = useCallback(
    (index: number, _key: string, insertText: string) => {
      const inputRef = valueInputRefs.current.get(index)
      if (inputRef) {
        // Use the insertAtCursor method from HighlightedInputRef
        inputRef.insertAtCursor(insertText)
      }
    },
    []
  )

  // Insert text into new entry value
  const handleInsertNew = useCallback(
    (insertText: string) => {
      const inputRef = newValueInputRef.current
      if (inputRef) {
        // Use the insertAtCursor method from HighlightedInputRef
        inputRef.insertAtCursor(insertText)
      }
    },
    []
  )

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <div className="text-base md:text-sm text-muted-foreground text-center py-6 md:py-4 border-2 border-dashed rounded-xl md:rounded-lg">
          No variables defined. Add one below.
        </div>
      )}

      {/* Existing entries */}
      {entries.map(([key, val], index) => {
        const isEditing = editingKeyIndex === index
        const displayKey = isEditing ? editingKeyValue : key
        const keyBorderStyle = getRefTypeBorderStyle(refTypes[key] || 'none')
        return (
        <div key={index} className="editor-entry-row flex-col md:flex-row items-stretch md:items-start">
          <div className="flex-1">
            <label className="block md:hidden text-sm font-medium mb-1.5 text-muted-foreground">
              Key
            </label>
            <input
              type="text"
              value={displayKey}
              onFocus={() => startKeyEdit(index, key)}
              onChange={(e) => setEditingKeyValue(e.target.value)}
              onBlur={() => commitKeyEdit(index, key, editingKeyValue)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                } else if (e.key === 'Escape') {
                  setEditingKeyIndex(null)
                  setEditingKeyValue('')
                }
              }}
              className="editor-input text-base md:text-sm font-mono min-h-[48px] md:min-h-0"
              style={keyBorderStyle}
              placeholder={keyPlaceholder}
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block md:hidden text-sm font-medium text-muted-foreground mb-1.5">Value</label>
            <div className="relative">
              <HighlightedInput
                ref={(el) => {
                  if (el) valueInputRefs.current.set(index, el)
                  else valueInputRefs.current.delete(index)
                }}
                value={val}
                onChange={(newVal) => updateEntryValue(key, newVal)}
                onFocus={() => setFocusedValueIndex(index)}
                onBlur={() => {
                  // Delay clearing focus to allow clicking insert button
                  setTimeout(() => setFocusedValueIndex((curr) => curr === index ? null : curr), 150)
                }}
                className={cn(
                  "editor-input text-base md:text-sm min-h-[48px] md:min-h-0 w-full",
                  hasInsertData && "pr-10"
                )}
                placeholder={valuePlaceholder}
                suggestions={suggestions}
                tableMap={tableMap}
                templateMap={templateMap}
                sharedVariables={sharedVariables}
              />
              {hasInsertData && (focusedValueIndex === index || openDropdownIndex === index) && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 z-10">
                  <InsertDropdown
                    localTables={localTables}
                    localTemplates={localTemplates}
                    importedTables={importedTables}
                    importedTemplates={importedTemplates}
                    onInsert={(text) => handleInsertExisting(index, key, text)}
                    buttonClassName="!px-1.5 !py-1 !text-[10px] bg-primary/20 hover:bg-primary/30"
                    onOpenChange={(isOpen) => setOpenDropdownIndex(isOpen ? index : null)}
                  />
                </div>
              )}
            </div>
            {valueSupportsExpressions && val?.includes('{{') && (
              <ExpressionPreview value={val} collectionId={collectionId} templateIds={templateIds} />
            )}
          </div>
          <button
            type="button"
            onClick={() => removeEntry(key)}
            className="p-3 md:p-2 hover:bg-destructive/10 hover:text-destructive rounded-xl md:rounded-lg transition-colors self-end md:self-auto min-w-[48px] min-h-[48px] md:min-w-0 md:min-h-0 flex items-center justify-center"
            title="Delete variable"
          >
            <Trash2 className="h-5 w-5 md:h-4 md:w-4" />
          </button>
        </div>
        )
      })}

      {/* Add new entry */}
      <div className="pt-3 md:pt-2 border-t border-border/50 space-y-3 md:space-y-2">
        <div className="flex flex-col md:flex-row gap-3 md:gap-2 items-stretch md:items-start">
          <div className="flex-1">
            <label className="block md:hidden text-sm font-medium mb-1.5 text-muted-foreground">
              New Key
            </label>
            <input
              ref={newKeyInputRef}
              type="text"
              value={newKey}
              onChange={(e) => {
                setNewKey(e.target.value)
                setKeyValidationError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && addEntry()}
              className="editor-input text-base md:text-sm font-mono min-h-[48px] md:min-h-0"
              placeholder={keyPlaceholder}
            />
          </div>
          <div className="flex-1">
            <label className="block md:hidden text-sm font-medium text-muted-foreground mb-1.5">New Value</label>
            <div className="relative">
              <HighlightedInput
                ref={newValueInputRef}
                value={newValue}
                onChange={setNewValue}
                onFocus={() => setNewValueFocused(true)}
                onBlur={() => {
                  // Delay clearing focus to allow clicking insert button
                  setTimeout(() => setNewValueFocused(false), 150)
                }}
                onKeyDown={(e) => e.key === 'Enter' && addEntry()}
                className={cn(
                  "editor-input text-base md:text-sm min-h-[48px] md:min-h-0 w-full",
                  hasInsertData && "pr-10"
                )}
                placeholder={valuePlaceholder}
                suggestions={suggestions}
                tableMap={tableMap}
                templateMap={templateMap}
                sharedVariables={sharedVariables}
              />
              {hasInsertData && (newValueFocused || newValueDropdownOpen) && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 z-10">
                  <InsertDropdown
                    localTables={localTables}
                    localTemplates={localTemplates}
                    importedTables={importedTables}
                    importedTemplates={importedTemplates}
                    onInsert={handleInsertNew}
                    buttonClassName="!px-1.5 !py-1 !text-[10px] bg-primary/20 hover:bg-primary/30"
                    onOpenChange={setNewValueDropdownOpen}
                  />
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={addEntry}
            disabled={!newKey.trim()}
            className="editor-input-btn flex items-center justify-center gap-2 md:gap-1.5 px-4 md:px-3 py-3 md:py-2 text-base md:text-sm rounded-xl md:rounded-lg min-h-[48px] md:min-h-0 self-end md:self-auto disabled:opacity-50"
          >
            <Plus className="h-5 w-5 md:h-4 md:w-4" />
            Add
          </button>
        </div>
        {keyValidationError && (
          <p className="text-sm md:text-xs text-destructive">{keyValidationError}</p>
        )}
      </div>

      {valueSupportsExpressions && (
        <div className="text-sm md:text-xs text-muted-foreground p-4 md:p-3 bg-muted/30 rounded-xl md:rounded-lg">
          <p>
            <strong>Tip:</strong> Shared variables support expressions like{' '}
            <code className="px-1.5 md:px-1 py-0.5 bg-muted rounded">{'{{dice:2d6}}'}</code>,{' '}
            <code className="px-1.5 md:px-1 py-0.5 bg-muted rounded">{'{{math:$var + 5}}'}</code>,
            or table references. They're evaluated in order, so later variables can
            reference earlier ones. Access properties with{' '}
            <code className="px-1.5 md:px-1 py-0.5 bg-muted rounded">{'{{$varName.@property}}'}</code>.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Compare two Sets by content (not reference).
 * Returns true if both Sets contain the same elements.
 */
function areSetsEqual(a?: Set<string>, b?: Set<string>): boolean {
  if (a === b) return true
  if (!a || !b) return a === b
  if (a.size !== b.size) return false
  for (const id of a) {
    if (!b.has(id)) return false
  }
  return true
}

/**
 * ExpressionPreview - Shows live preview of expression evaluation
 * Memoized to only re-render when its own value changes, not when sibling fields change.
 * Uses custom comparison to compare templateIds Set by content, not reference.
 */
const ExpressionPreview = memo(function ExpressionPreview({
  value,
  collectionId,
  templateIds,
}: {
  value: string
  collectionId?: string
  templateIds?: Set<string>
}) {
  const { result, reroll, isEvaluating } = usePatternEvaluation(value, collectionId, {
    enableTrace: false,
    debounceMs: 300,
    templateIds,
  })

  // No collection ID - can't evaluate
  if (!collectionId) {
    return (
      <p className="text-xs text-muted-foreground mt-1">
        Expression detected (save to preview)
      </p>
    )
  }

  // Show preview with re-roll button
  const displayText = isEvaluating
    ? '...'
    : result?.error
      ? result.error
      : result?.fullText || '...'

  const hasError = result?.error != null

  return (
    <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
      <span
        className={cn(
          'text-xs truncate',
          hasError ? 'text-destructive' : 'text-muted-foreground'
        )}
        title={displayText}
      >
        → {displayText}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          reroll()
        }}
        className="p-0.5 rounded hover:bg-accent transition-colors flex-shrink-0"
        title="Re-roll expression"
      >
        <RefreshCw
          className={cn(
            'w-3 h-3 text-muted-foreground',
            isEvaluating && 'animate-spin'
          )}
        />
      </button>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison: compare value and collectionId directly,
  // but compare templateIds by content (not reference)
  return (
    prevProps.value === nextProps.value &&
    prevProps.collectionId === nextProps.collectionId &&
    areSetsEqual(prevProps.templateIds, nextProps.templateIds)
  )
})

export default KeyValueEditor
