/**
 * TableEditor Component
 *
 * Visual editor for tables (simple, composite, collection).
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Eye,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EntryEditor } from './EntryEditor'
import { KeyValueEditor } from './KeyValueEditor'
import { ResultTypeSelector } from './ResultTypeSelector'
import { SortableList } from './SortableList'
import { SortableItem } from './SortableItem'
import type {
  Table,
  Template,
  SimpleTable,
  CompositeTable,
  CollectionTable,
  Entry,
  CompositeSource,
  SharedVariables,
  TableSource,
} from '@/engine/types'
import type { TableInfo, TemplateInfo, ImportedTableInfo, ImportedTemplateInfo } from '@/engine/core'
import { getTableProperties, type Suggestion } from '@/hooks/usePatternSuggestions'
import { AtSign } from 'lucide-react'

export interface TableEditorProps {
  /** The table to edit */
  table: Table
  /** Called when table changes */
  onChange: (table: Table) => void
  /** Called when table should be deleted */
  onDelete: () => void
  /** Available table IDs for references */
  availableTableIds: string[]
  /** Whether the table card is expanded */
  defaultExpanded?: boolean
  /** Collection ID for live preview evaluation */
  collectionId?: string
  /** Called when any field in the editor gains focus */
  onFocus?: () => void
  /** Called when focus leaves the editor entirely */
  onBlur?: () => void
  /** Called when expansion state changes (isExpanded) */
  onExpandChange?: (isExpanded: boolean) => void
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
  /** Full table data for property lookups (keyed by table ID) */
  tableMap?: Map<string, Table>
  /** Full template data for property lookups (keyed by template ID) */
  templateMap?: Map<string, Template>
  /** Document-level shared variables for autocomplete */
  sharedVariables?: Record<string, string>
}

export function TableEditor({
  table,
  onChange,
  onDelete,
  availableTableIds,
  defaultExpanded = false,
  collectionId,
  onFocus,
  onBlur,
  onExpandChange,
  localTables = [],
  localTemplates = [],
  importedTables = [],
  importedTemplates = [],
  suggestions,
  tableMap,
  templateMap,
  sharedVariables,
}: TableEditorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const prevDefaultExpandedRef = useRef(defaultExpanded)

  // Shared Variables / Default Sets tab state
  type SharedSetsTab = 'shared' | 'defaultSets'
  const [sharedSetsTab, setSharedSetsTab] = useState<SharedSetsTab>(() => {
    const sharedCount = Object.keys(table.shared || {}).length
    const defaultSetsCount = Object.keys(table.defaultSets || {}).length
    if (sharedCount === 0 && defaultSetsCount > 0) return 'defaultSets'
    return 'shared'
  })

  // Memoized counts for tab badges
  const sharedCount = useMemo(() => Object.keys(table.shared || {}).length, [table.shared])
  const defaultSetsCount = useMemo(() => Object.keys(table.defaultSets || {}).length, [table.defaultSets])

  // Expand when defaultExpanded transitions from false to true (explicit selection)
  // Don't force open just because defaultExpanded is true - allow user to collapse
  useEffect(() => {
    if (defaultExpanded && !prevDefaultExpandedRef.current) {
      setIsExpanded(true)
      onExpandChange?.(true)
    }
    prevDefaultExpandedRef.current = defaultExpanded
  }, [defaultExpanded, onExpandChange])

  // Auto-select non-empty tab when switching tables
  useEffect(() => {
    const sc = Object.keys(table.shared || {}).length
    const dc = Object.keys(table.defaultSets || {}).length
    if (sc === 0 && dc > 0) setSharedSetsTab('defaultSets')
    else if (dc === 0 && sc > 0) setSharedSetsTab('shared')
  }, [table.id])

  // Handle manual expand/collapse toggle
  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)
    onExpandChange?.(newExpanded)
  }, [isExpanded, onExpandChange])

  // Focus tracking for dynamic selection
  const handleFocus = useCallback(() => {
    onFocus?.()
  }, [onFocus])

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Only trigger if focus is leaving the entire editor
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        onBlur?.()
      }
    },
    [onBlur]
  )

  const updateField = useCallback(
    <K extends keyof Table>(field: K, value: Table[K]) => {
      onChange({ ...table, [field]: value } as Table)
    },
    [table, onChange]
  )

  const updateSource = useCallback(
    <K extends keyof TableSource>(field: K, value: TableSource[K]) => {
      const newSource = { ...(table.source || {}), [field]: value }
      // Remove empty fields
      Object.keys(newSource).forEach((k) => {
        if (!newSource[k as keyof TableSource]) delete newSource[k as keyof TableSource]
      })
      onChange({
        ...table,
        source: Object.keys(newSource).length > 0 ? newSource : undefined,
      } as Table)
    },
    [table, onChange]
  )

  const changeTableType = useCallback(
    (newType: 'simple' | 'composite' | 'collection') => {
      if (newType === table.type) return

      const baseProps = {
        id: table.id,
        name: table.name,
        type: newType,
        description: table.description,
        tags: table.tags,
        hidden: table.hidden,
        defaultSets: table.defaultSets,
        resultType: table.resultType,
      }

      let newTable: Table
      if (newType === 'simple') {
        newTable = {
          ...baseProps,
          type: 'simple',
          entries: [{ value: 'New entry' }],
        } as SimpleTable
      } else if (newType === 'composite') {
        newTable = {
          ...baseProps,
          type: 'composite',
          sources: [{ tableId: '' }],
        } as CompositeTable
      } else {
        newTable = {
          ...baseProps,
          type: 'collection',
          collections: [],
        } as CollectionTable
      }

      onChange(newTable)
    },
    [table, onChange]
  )

  return (
    <div className={cn("editor-card", isExpanded && "editor-card-expanded")} onFocus={handleFocus} onBlur={handleBlur}>
      {/* Table Header */}
      <div
        className={cn(
          'editor-accordion-header',
          'min-h-[56px] md:min-h-0',
          isExpanded && 'border-b border-border/50'
        )}
        onClick={handleToggleExpand}
      >
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate text-base md:text-sm">{table.name || 'Untitled Table'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {table.type}
            </span>
            {table.hidden && (
              <span title="Hidden">
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              </span>
            )}
          </div>
          <span className="text-sm text-muted-foreground">{table.id}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-3 md:p-2 hover:bg-destructive/10 hover:text-destructive rounded-xl md:rounded transition-colors min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
          title="Delete table"
        >
          <Trash2 className="h-5 w-5 md:h-4 md:w-4" />
        </button>
      </div>

      {/* Table Content */}
      {isExpanded && (
        <div className="p-4 space-y-5 mobile-form-container">
          {/* Basic Info */}
          <div className="editor-field-group">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="editor-label editor-label-required">Table ID</label>
                <input
                  type="text"
                  value={table.id}
                  onChange={(e) => updateField('id', e.target.value)}
                  placeholder="uniqueTableId"
                  className="editor-input text-base md:text-sm min-h-[48px] md:min-h-0"
                />
              </div>

              <div>
                <label className="editor-label editor-label-required">Name</label>
                <input
                  type="text"
                  value={table.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Table Name"
                  className="editor-input text-base md:text-sm min-h-[48px] md:min-h-0"
                />
              </div>

              <div>
                <label className="editor-label">Type</label>
                <select
                  value={table.type}
                  onChange={(e) =>
                    changeTableType(
                      e.target.value as 'simple' | 'composite' | 'collection'
                    )
                  }
                  className="editor-select text-base md:text-sm min-h-[48px] md:min-h-0"
                >
                  <option value="simple">Simple (Weighted Entries)</option>
                  <option value="composite">Composite (Select Table)</option>
                  <option value="collection">Collection (Merge Tables)</option>
                </select>
              </div>

              <div>
                <label className="editor-label">Result Type</label>
                <ResultTypeSelector
                  value={table.resultType}
                  onChange={(value) => updateField('resultType', value)}
                  placeholder="Select or enter type..."
                />
              </div>
            </div>

            {/* Description */}
            <div className="mt-4">
              <label className="editor-label">Description</label>
              <textarea
                value={table.description || ''}
                onChange={(e) => updateField('description', e.target.value || undefined)}
                placeholder="Table description (Markdown supported)"
                rows={2}
                className="editor-input text-base md:text-sm resize-y"
              />
            </div>
          </div>

          {/* Options Row */}
          <div className="flex flex-col md:flex-row flex-wrap gap-4 items-start md:items-center">
            <label className="flex items-center gap-3 md:gap-2 text-base md:text-sm p-3 md:p-2 editor-entry-row md:border-0 md:bg-transparent w-full md:w-auto cursor-pointer">
              <input
                type="checkbox"
                checked={table.hidden || false}
                onChange={(e) => updateField('hidden', e.target.checked || undefined)}
                className="rounded border-border w-5 h-5 md:w-4 md:h-4 accent-primary"
              />
              <span className="flex items-center gap-2 md:gap-1">
                {table.hidden ? <EyeOff className="h-5 w-5 md:h-4 md:w-4" /> : <Eye className="h-5 w-5 md:h-4 md:w-4" />}
                Hidden from UI
              </span>
            </label>

            {table.type === 'simple' && (
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2 w-full md:w-auto">
                <label className="editor-label md:mb-0">Extends:</label>
                <select
                  value={table.extends || ''}
                  onChange={(e) => updateField('extends', e.target.value || undefined)}
                  className="editor-select w-full md:w-auto text-base md:text-sm min-h-[48px] md:min-h-0"
                >
                  <option value="">None</option>
                  {availableTableIds
                    .filter((id) => id !== table.id)
                    .map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Shared Variables / Default Sets (collapsible with tabs) */}
          <details className="editor-collapsible">
            <summary>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Shared Variables / Default Sets</span>
                {sharedCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-rose/15 text-rose">
                    {sharedCount}
                  </span>
                )}
                {defaultSetsCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-mint/15 text-mint">
                    {defaultSetsCount}
                  </span>
                )}
                {sharedCount === 0 && defaultSetsCount === 0 && (
                  <span className="text-xs text-muted-foreground">(optional)</span>
                )}
                <div className="group relative">
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  <div className="absolute left-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs bg-popover border rounded-md shadow-lg">
                    Shared Variables are evaluated lazily when rolled and propagate to nested tables.
                    Default Sets provide default placeholder values for all entries in this table.
                  </div>
                </div>
              </div>
            </summary>
            <div className="editor-collapsible-content space-y-3">
              {/* Mini Tab Bar */}
              <div className="flex border-b border-border/50" role="tablist">
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                    'border-b-2 -mb-px',
                    sharedSetsTab === 'shared'
                      ? 'text-rose border-rose'
                      : 'text-muted-foreground border-transparent hover:text-foreground/80'
                  )}
                  onClick={() => setSharedSetsTab('shared')}
                  role="tab"
                  aria-selected={sharedSetsTab === 'shared'}
                >
                  <span>Shared Variables</span>
                  {sharedCount > 0 && (
                    <span className={cn(
                      'px-1.5 py-0.5 text-xs rounded-full',
                      sharedSetsTab === 'shared' ? 'bg-rose/15 text-rose' : 'bg-muted text-muted-foreground'
                    )}>
                      {sharedCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                    'border-b-2 -mb-px',
                    sharedSetsTab === 'defaultSets'
                      ? 'text-mint border-mint'
                      : 'text-muted-foreground border-transparent hover:text-foreground/80'
                  )}
                  onClick={() => setSharedSetsTab('defaultSets')}
                  role="tab"
                  aria-selected={sharedSetsTab === 'defaultSets'}
                >
                  <span>Default Sets</span>
                  {defaultSetsCount > 0 && (
                    <span className={cn(
                      'px-1.5 py-0.5 text-xs rounded-full',
                      sharedSetsTab === 'defaultSets' ? 'bg-mint/15 text-mint' : 'bg-muted text-muted-foreground'
                    )}>
                      {defaultSetsCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Content: Shared Variables */}
              {sharedSetsTab === 'shared' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Variables evaluated when this table is rolled. Available to nested table references.
                  </p>
                  <KeyValueEditor
                    value={(table.shared as SharedVariables) || {}}
                    onChange={(shared) =>
                      updateField('shared', Object.keys(shared).length > 0 ? shared : undefined)
                    }
                    keyPlaceholder="Variable name"
                    valuePlaceholder="Value (supports {{dice:}}, {{math:}}, etc.)"
                    keyPattern="^\$?[a-zA-Z_][a-zA-Z0-9_]*$"
                    keyError="Must start with letter/underscore, alphanumeric only"
                    valueSupportsExpressions
                    collectionId={collectionId}
                    showInsertButton
                    localTables={localTables}
                    localTemplates={localTemplates}
                    importedTables={importedTables}
                    importedTemplates={importedTemplates}
                    suggestions={suggestions}
                    tableMap={tableMap}
                    templateMap={templateMap}
                    sharedVariables={{ ...sharedVariables, ...table.shared as Record<string, string> }}
                  />
                </div>
              )}

              {/* Tab Content: Default Sets */}
              {sharedSetsTab === 'defaultSets' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Default placeholder values applied to all entries. Can be overridden by entry-specific sets.
                  </p>
                  <KeyValueEditor
                    value={table.defaultSets || {}}
                    onChange={(defaultSets) =>
                      updateField('defaultSets', Object.keys(defaultSets).length > 0 ? defaultSets : undefined)
                    }
                    keyPlaceholder="Key (@key)"
                    valuePlaceholder="Value or {{pattern}}"
                    valueSupportsExpressions={true}
                    collectionId={collectionId}
                    showInsertButton
                    localTables={localTables}
                    localTemplates={localTemplates}
                    importedTables={importedTables}
                    importedTemplates={importedTemplates}
                    suggestions={suggestions}
                    tableMap={tableMap}
                    templateMap={templateMap}
                    sharedVariables={{ ...sharedVariables, ...table.shared as Record<string, string> }}
                  />
                </div>
              )}
            </div>
          </details>

          {/* Type-specific content */}
          {table.type === 'simple' && (
            <SimpleTableEditor
              table={table}
              onChange={onChange}
              collectionId={collectionId}
              localTables={localTables}
              localTemplates={localTemplates}
              importedTables={importedTables}
              importedTemplates={importedTemplates}
              suggestions={suggestions}
              tableMap={tableMap}
              templateMap={templateMap}
              sharedVariables={sharedVariables}
            />
          )}

          {table.type === 'composite' && (
            <CompositeTableEditor
              table={table}
              onChange={onChange}
              availableTableIds={availableTableIds}
            />
          )}

          {table.type === 'collection' && (
            <CollectionTableEditor
              table={table}
              onChange={onChange}
              availableTableIds={availableTableIds}
            />
          )}

          {/* Source Attribution (collapsible) */}
          <details className="editor-collapsible">
            <summary>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Source Attribution</span>
                <span className="text-xs text-muted-foreground">(optional)</span>
                <div className="group relative">
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  <div className="absolute left-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs bg-popover border rounded-md shadow-lg">
                    Track where this table originated. Useful when combining content from multiple sources.
                  </div>
                </div>
              </div>
            </summary>
            <div className="editor-collapsible-content space-y-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div>
                  <label className="editor-label">Book</label>
                  <input
                    type="text"
                    value={table.source?.book || ''}
                    onChange={(e) => updateSource('book', e.target.value || undefined)}
                    placeholder="Source book name"
                    className="editor-input text-base md:text-sm min-h-[48px] md:min-h-0"
                  />
                </div>
                <div>
                  <label className="editor-label">Page</label>
                  <input
                    type="text"
                    value={table.source?.page?.toString() || ''}
                    onChange={(e) => updateSource('page', e.target.value || undefined)}
                    placeholder="47 or 47-49"
                    className="editor-input text-base md:text-sm min-h-[48px] md:min-h-0"
                  />
                </div>
                <div>
                  <label className="editor-label">Section</label>
                  <input
                    type="text"
                    value={table.source?.section || ''}
                    onChange={(e) => updateSource('section', e.target.value || undefined)}
                    placeholder="Chapter or section name"
                    className="editor-input text-base md:text-sm min-h-[48px] md:min-h-0"
                  />
                </div>
                <div>
                  <label className="editor-label">License</label>
                  <input
                    type="text"
                    value={table.source?.license || ''}
                    onChange={(e) => updateSource('license', e.target.value || undefined)}
                    placeholder="OGL 1.0a, CC BY 4.0, etc."
                    className="editor-input text-base md:text-sm min-h-[48px] md:min-h-0"
                  />
                </div>
              </div>
              <div>
                <label className="editor-label">URL</label>
                <input
                  type="url"
                  value={table.source?.url || ''}
                  onChange={(e) => updateSource('url', e.target.value || undefined)}
                  placeholder="https://..."
                  className="editor-input text-base md:text-sm min-h-[48px] md:min-h-0"
                />
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

interface SimpleTableEditorProps {
  table: SimpleTable
  onChange: (table: SimpleTable) => void
  collectionId?: string
  localTables?: TableInfo[]
  localTemplates?: TemplateInfo[]
  importedTables?: ImportedTableInfo[]
  importedTemplates?: ImportedTemplateInfo[]
  suggestions?: Suggestion[]
  tableMap?: Map<string, Table>
  templateMap?: Map<string, Template>
  sharedVariables?: Record<string, string>
}

function SimpleTableEditor({
  table,
  onChange,
  collectionId,
  localTables = [],
  localTemplates = [],
  importedTables = [],
  importedTemplates = [],
  suggestions,
  tableMap,
  templateMap,
  sharedVariables,
}: SimpleTableEditorProps) {
  const [focusedEntryIndex, setFocusedEntryIndex] = useState<number | null>(null)
  const [expandedEntryIndex, setExpandedEntryIndex] = useState<number | null>(null)
  const [collapsedEntryIndex, setCollapsedEntryIndex] = useState<number | null>(null)
  const [clonedEntryIndex, setClonedEntryIndex] = useState<number | null>(null)

  // Build placeholder suggestions from this table's set keys
  // This includes defaultSets and all entry.sets keys
  const suggestionsWithTableSets = useMemo(() => {
    const tableSetKeys = getTableProperties(table)
    // Filter out 'value' and 'description' as they're always available and less useful to show
    const setKeys = tableSetKeys.filter(k => k !== 'value' && k !== 'description')

    if (setKeys.length === 0) {
      return suggestions || []
    }

    // Build placeholder suggestions for each set key
    const placeholderSuggestions: Suggestion[] = setKeys.map(key => ({
      id: `placeholder-table-${table.id}-${key}`,
      label: `@${key}`,
      insertText: `@${key}`,
      category: 'placeholder' as const,
      description: `Set property from ${table.name || table.id}`,
      icon: AtSign,
      source: 'This Table',
      colorClass: 'cyan' as const,
    }))

    // Merge with existing suggestions, avoiding duplicates
    const existingIds = new Set((suggestions || []).map(s => s.id))
    const newSuggestions = placeholderSuggestions.filter(s => !existingIds.has(s.id))

    return [...(suggestions || []), ...newSuggestions]
  }, [suggestions, table])

  // Clear focus state after it's been applied
  useEffect(() => {
    if (focusedEntryIndex !== null) {
      const timer = setTimeout(() => setFocusedEntryIndex(null), 100)
      return () => clearTimeout(timer)
    }
  }, [focusedEntryIndex])

  // Clear expanded/collapsed state after it's been applied
  useEffect(() => {
    if (expandedEntryIndex !== null || collapsedEntryIndex !== null) {
      const timer = setTimeout(() => {
        setExpandedEntryIndex(null)
        setCollapsedEntryIndex(null)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [expandedEntryIndex, collapsedEntryIndex])

  // Clear cloned animation state after animation completes
  useEffect(() => {
    if (clonedEntryIndex !== null) {
      const timer = setTimeout(() => setClonedEntryIndex(null), 600)
      return () => clearTimeout(timer)
    }
  }, [clonedEntryIndex])

  const addEntry = useCallback(() => {
    const newIndex = table.entries.length
    onChange({
      ...table,
      entries: [...table.entries, { value: '' }],
    })
    // Set focus to the new entry
    setFocusedEntryIndex(newIndex)
  }, [table, onChange])

  const updateEntry = useCallback(
    (index: number, entry: Entry) => {
      const entries = [...table.entries]
      entries[index] = entry
      onChange({ ...table, entries })
    },
    [table, onChange]
  )

  const deleteEntry = useCallback(
    (index: number) => {
      if (table.entries.length <= 1) return // Keep at least one entry
      onChange({
        ...table,
        entries: table.entries.filter((_, i) => i !== index),
      })
    },
    [table, onChange]
  )

  const cloneEntry = useCallback(
    (index: number) => {
      const entryToClone = table.entries[index]
      // Deep clone the entry
      const clonedEntry: Entry = JSON.parse(JSON.stringify(entryToClone))
      // Clear the ID so it gets a new one (or mark it as a clone)
      if (clonedEntry.id) {
        clonedEntry.id = `${clonedEntry.id}_copy`
      }
      // Insert the clone after the original
      const newEntries = [...table.entries]
      newEntries.splice(index + 1, 0, clonedEntry)
      onChange({ ...table, entries: newEntries })
      // Set the cloned entry to be expanded and the original to be collapsed
      setExpandedEntryIndex(index + 1)
      setCollapsedEntryIndex(index)
      // Trigger clone animation
      setClonedEntryIndex(index + 1)
    },
    [table, onChange]
  )

  const handleReorder = useCallback(
    (reorderedEntries: Entry[]) => {
      onChange({ ...table, entries: reorderedEntries })
    },
    [table, onChange]
  )

  // Generate unique IDs for entries without them (for drag-drop)
  const getEntryId = useCallback((entry: Entry, index: number) => {
    return entry.id || `entry-${index}`
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base md:text-sm font-medium">Entries ({table.entries.length})</h3>
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-2 px-4 md:px-3 py-2.5 md:py-1.5 text-base md:text-sm border rounded-xl md:rounded-md hover:bg-accent active:bg-accent/70 transition-colors min-h-[44px] md:min-h-0"
        >
          <Plus className="h-5 w-5 md:h-4 md:w-4" />
          Add Entry
        </button>
      </div>

      <SortableList
        items={table.entries}
        getItemId={(entry) => getEntryId(entry, table.entries.indexOf(entry))}
        onReorder={handleReorder}
      >
        <div className="space-y-3 md:space-y-2">
          {table.entries.map((entry, index) => (
            <SortableItem
              key={`entry-${index}`}
              id={getEntryId(entry, index)}
            >
              <EntryEditor
                entry={entry}
                onChange={(updated) => updateEntry(index, updated)}
                onDelete={() => deleteEntry(index)}
                onAddEntry={addEntry}
                onClone={() => cloneEntry(index)}
                index={index}
                canDelete={table.entries.length > 1}
                collectionId={collectionId}
                autoFocus={focusedEntryIndex === index}
                defaultExpanded={expandedEntryIndex === index ? true : collapsedEntryIndex === index ? false : undefined}
                isCloned={clonedEntryIndex === index}
                localTables={localTables}
                localTemplates={localTemplates}
                importedTables={importedTables}
                importedTemplates={importedTemplates}
                suggestions={suggestionsWithTableSets}
                tableMap={tableMap}
                templateMap={templateMap}
                sharedVariables={{ ...sharedVariables, ...table.shared }}
              />
            </SortableItem>
          ))}
        </div>
      </SortableList>
    </div>
  )
}

interface CompositeTableEditorProps {
  table: CompositeTable
  onChange: (table: CompositeTable) => void
  availableTableIds: string[]
}

function CompositeTableEditor({
  table,
  onChange,
  availableTableIds,
}: CompositeTableEditorProps) {
  const addSource = useCallback(() => {
    onChange({
      ...table,
      sources: [...table.sources, { tableId: '', weight: 1 }],
    })
  }, [table, onChange])

  const updateSource = useCallback(
    (index: number, source: CompositeSource) => {
      const sources = [...table.sources]
      sources[index] = source
      onChange({ ...table, sources })
    },
    [table, onChange]
  )

  const deleteSource = useCallback(
    (index: number) => {
      if (table.sources.length <= 1) return
      onChange({
        ...table,
        sources: table.sources.filter((_, i) => i !== index),
      })
    },
    [table, onChange]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base md:text-sm font-medium">Source Tables ({table.sources.length})</h3>
        <button
          type="button"
          onClick={addSource}
          className="flex items-center gap-2 px-4 md:px-3 py-2.5 md:py-1.5 text-base md:text-sm border rounded-xl md:rounded-md hover:bg-accent active:bg-accent/70 transition-colors min-h-[44px] md:min-h-0"
        >
          <Plus className="h-5 w-5 md:h-4 md:w-4" />
          Add Source
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Composite tables select one source table based on weight, then roll on that table.
      </p>

      <div className="space-y-2">
        {table.sources.map((source, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 border rounded-lg"
          >
            <span className="text-sm text-muted-foreground w-8">
              #{index + 1}
            </span>

            <select
              value={source.tableId}
              onChange={(e) =>
                updateSource(index, { ...source, tableId: e.target.value })
              }
              className="flex-1 p-2 border rounded-md bg-background text-sm"
            >
              <option value="">Select a table...</option>
              {availableTableIds
                .filter((id) => id !== table.id)
                .map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
            </select>

            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Weight:</label>
              <input
                type="number"
                value={source.weight ?? 1}
                onChange={(e) =>
                  updateSource(index, {
                    ...source,
                    weight: parseFloat(e.target.value) || 1,
                  })
                }
                min={0}
                step={0.1}
                className="w-16 p-2 border rounded-md bg-background text-sm text-center"
              />
            </div>

            <button
              type="button"
              onClick={() => deleteSource(index)}
              disabled={table.sources.length <= 1}
              className="p-2 hover:bg-destructive/10 hover:text-destructive rounded transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

interface CollectionTableEditorProps {
  table: CollectionTable
  onChange: (table: CollectionTable) => void
  availableTableIds: string[]
}

function CollectionTableEditor({
  table,
  onChange,
  availableTableIds,
}: CollectionTableEditorProps) {
  const addCollection = useCallback(() => {
    onChange({
      ...table,
      collections: [...table.collections, ''],
    })
  }, [table, onChange])

  const updateCollection = useCallback(
    (index: number, tableId: string) => {
      const collections = [...table.collections]
      collections[index] = tableId
      onChange({ ...table, collections })
    },
    [table, onChange]
  )

  const deleteCollection = useCallback(
    (index: number) => {
      if (table.collections.length <= 1) return
      onChange({
        ...table,
        collections: table.collections.filter((_, i) => i !== index),
      })
    },
    [table, onChange]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">
          Collected Tables ({table.collections.length})
        </h3>
        <button
          type="button"
          onClick={addCollection}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Table
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Collection tables merge all entries from multiple tables into a single
        pool.
      </p>

      <div className="space-y-2">
        {table.collections.map((tableId, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 border rounded-lg"
          >
            <span className="text-sm text-muted-foreground w-8">
              #{index + 1}
            </span>

            <select
              value={tableId}
              onChange={(e) => updateCollection(index, e.target.value)}
              className="flex-1 p-2 border rounded-md bg-background text-sm"
            >
              <option value="">Select a table...</option>
              {availableTableIds
                .filter((id) => id !== table.id)
                .map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
            </select>

            <button
              type="button"
              onClick={() => deleteCollection(index)}
              disabled={table.collections.length <= 1}
              className="p-2 hover:bg-destructive/10 hover:text-destructive rounded transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TableEditor
