/**
 * EntryEditor Component
 *
 * Editor for individual table entries in simple tables.
 */

import { useState, useCallback, useMemo, useRef, useEffect, useId } from 'react'
import { ChevronDown, ChevronRight, Trash2, X, Eye, EyeOff, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { extractExpressions } from '@/engine/core/parser'
import { InlineResult } from './PatternPreview/InlineResult'
import { PatternPreview } from './PatternPreview/PatternPreview'
import { HighlightedInput, type HighlightedInputRef } from './PatternPreview/HighlightedInput'
import { usePatternEvaluation } from './PatternPreview/usePatternEvaluation'
import { ResultTypeSelector } from './ResultTypeSelector'
import { KeyValueEditor } from './KeyValueEditor'
import type { AuthoredEntry as Entry, Table, Template } from '@/engine/types'
import type { TableInfo, TemplateInfo, ImportedTableInfo, ImportedTemplateInfo } from '@/engine/core'
import type { Suggestion } from '@/hooks/usePatternSuggestions'

export interface EntryEditorProps {
  /** The entry to edit */
  entry: Entry
  /** Called when entry changes */
  onChange: (entry: Entry) => void
  /** Called when entry should be deleted */
  onDelete: () => void
  /** Called when Enter is pressed on a valid entry to add a new one */
  onAddEntry?: () => void
  /** Called when entry should be cloned */
  onClone?: () => void
  /** Index for display */
  index: number
  /** Whether entry is being dragged */
  isDragging?: boolean
  /** Whether the delete button should be enabled */
  canDelete?: boolean
  /** Collection ID for live preview evaluation */
  collectionId?: string
  /** Whether to auto-focus the value input on mount */
  autoFocus?: boolean
  /** Whether to start expanded (used for cloned entries) */
  defaultExpanded?: boolean
  /** Whether this entry was just cloned (triggers animation) */
  isCloned?: boolean
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
  /** Table-level shared variables for preview evaluation. */
  sharedVariables?: Record<string, string>
  /** Native source dice require literal ranges, including zero and negative totals. */
  nativeDice?: boolean
  /** Combined document and table variables for autocomplete. */
  autocompleteSharedVariables?: Record<string, string>
}

export function EntryEditor({
  entry,
  onChange,
  onDelete,
  onAddEntry,
  onClone,
  index,
  isDragging,
  canDelete = true,
  collectionId,
  autoFocus = false,
  defaultExpanded,
  isCloned = false,
  localTables = [],
  localTemplates = [],
  importedTables = [],
  importedTemplates = [],
  suggestions,
  tableMap,
  templateMap,
  sharedVariables,
  autocompleteSharedVariables = sharedVariables,
  nativeDice = false,
}: EntryEditorProps) {
  // Inherited overrides may intentionally omit their value; display an empty
  // input while retaining the authored omission until the user changes it.
  const fieldId = useId()
  const entryValue = entry.value ?? ''
  const configured = [
    ...(nativeDice && entry.weight !== undefined ? ['weight needs removal'] : []),
    ...(entry.id ? ['ID'] : []),
    ...(entry.description !== undefined ? ['description'] : []),
    ...(entry.resultType !== undefined ? ['result classification'] : []),
    ...(entry.sets !== undefined ? ['properties'] : []),
    ...(entry.assets !== undefined ? ['assets'] : []),
    ...(entry.tags !== undefined ? ['tags'] : []),
  ]
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? configured.length > 0)
  const [showPreview, setShowPreview] = useState(false)
  const [weightMode, setWeightMode] = useState<'weight' | 'range'>(
    entry.range ? 'range' : 'weight'
  )
  useEffect(() => {
    setWeightMode(entry.range ? 'range' : 'weight')
  }, [entry.range])

  const desktopInputRef = useRef<HighlightedInputRef>(null)
  const mobileInputRef = useRef<HighlightedInputRef>(null)
  // Respond to explicit defaultExpanded prop changes (only true/false, not undefined)
  useEffect(() => {
    if (defaultExpanded === true) {
      setIsExpanded(true)
    } else if (defaultExpanded === false) {
      setIsExpanded(false)
    }
    // Ignore undefined - only react to explicit true/false
  }, [defaultExpanded])

  // Auto-focus the value input when requested
  // Use setTimeout to ensure the element is fully rendered and visible
  useEffect(() => {
    if (autoFocus) {
      // Small delay to ensure DOM is ready after React re-render
      const timer = setTimeout(() => {
        // Check which input is visible and focus it
        // Desktop input is visible when md:flex is active (≥768px)
        const isMobile = window.innerWidth < 768
        const inputToFocus = isMobile ? mobileInputRef.current : desktopInputRef.current
        inputToFocus?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [autoFocus])

  // Check if entry value contains expressions
  const hasExpressions = useMemo(() => {
    return extractExpressions(entryValue).length > 0
  }, [entryValue])

  // Extract template IDs for expression type detection (lavender vs mint)
  const templateIds = useMemo(() => {
    if (!templateMap || templateMap.size === 0) return undefined
    return new Set(templateMap.keys())
  }, [templateMap])

  // Evaluate for preview (only when preview is shown)
  const { result, reroll } = usePatternEvaluation(
    showPreview ? entryValue : '',
    collectionId,
    { enableTrace: false, debounceMs: 200, templateIds, sharedVariables }
  )

  const updateField = useCallback(
    <K extends keyof Entry>(field: K, value: Entry[K]) => {
      const updated = { ...entry, [field]: value }
      // Remove undefined/empty values
      if (value === undefined || (value === '' && field !== 'value')) {
        delete updated[field]
      }
      onChange(updated)
    },
    [entry, onChange]
  )

  const handleWeightModeChange = useCallback(
    (mode: 'weight' | 'range') => {
      setWeightMode(mode)
      if (mode === 'weight') {
        const updated = { ...entry }
        delete updated.range
        updated.weight = 1
        onChange(updated)
      } else {
        const updated = { ...entry }
        delete updated.weight
        updated.range = entry.range ?? [1, 1]
        onChange(updated)
      }
    },
    [entry, onChange]
  )

  const handleRangeChange = useCallback(
    (index: 0 | 1, value: number) => {
      const range = [...(entry.range || [1, 1])] as [number, number]
      range[index] = value
      if (!range.every(Number.isSafeInteger)) return
      updateField('range', range)
    },
    [entry.range, updateField]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && entryValue.trim() && onAddEntry) {
        e.preventDefault()
        onAddEntry()
      }
    },
    [entryValue, onAddEntry]
  )

  return (
    <div
      className={cn(
        'border rounded-xl md:rounded-lg transition-all duration-300',
        'md:border md:rounded-lg',
        isDragging && 'shadow-lg bg-background',
        isCloned && 'animate-clone-highlight'
      )}
    >
      {/* Entry Header - Desktop: inline, Mobile: stacked card */}
      <div className="hidden md:flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={!!isExpanded}
          aria-label={`Advanced settings for entry ${index + 1}${configured.length ? `; configured: ${configured.join(', ')}` : ''}`}
          className="p-1 hover:bg-accent rounded flex items-center gap-1"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="text-xs">Advanced{configured.length ? ` (${configured.length})` : ''}</span>
        </button>

        <span className="text-sm text-muted-foreground w-8">#{index + 1}</span>

        <label className="flex-1 min-w-0">
          <span className="sr-only">Value for entry {index + 1}</span>
          <HighlightedInput
            ref={desktopInputRef}
            value={entryValue}
            onChange={(value) => updateField('value', value)}
            onKeyDown={handleKeyDown}
            placeholder="Entry value (supports {{...}} templates)"
            wrapperClassName="flex-1 min-w-0"
            className="w-full p-2 border rounded-md bg-background text-sm"
            suggestions={suggestions}
            tableMap={tableMap}
            templateMap={templateMap}
            sharedVariables={autocompleteSharedVariables}
          />
        </label>

        <div className="flex items-center gap-2">
          {weightMode === 'weight' && !nativeDice ? (
            <input
              type="number"
              value={entry.weight ?? 1}
              onChange={(e) =>
                updateField(
                  'weight',
                  e.target.value ? parseFloat(e.target.value) : 1
                )
              }
              min={0}
              step={0.1}
              className="w-16 p-2 border rounded-md bg-background text-sm text-center"
              title="Weight"
              aria-label={`Weight for entry ${index + 1}`}
            />
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={entry.range?.[0] ?? 1}
                onChange={(e) =>
                  handleRangeChange(0, e.target.value === '' ? 1 : Number(e.target.value))
                }
                min={nativeDice ? undefined : 1}
                className="w-12 p-2 border rounded-md bg-background text-sm text-center"
                title="Range start"
                aria-label={`Range start for entry ${index + 1}`}
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="number"
                value={entry.range?.[1] ?? 1}
                onChange={(e) =>
                  handleRangeChange(1, e.target.value === '' ? 1 : Number(e.target.value))
                }
                min={entry.range?.[0] ?? 1}
                className="w-12 p-2 border rounded-md bg-background text-sm text-center"
                title="Range end"
                aria-label={`Range end for entry ${index + 1}`}
              />
            </div>
          )}

          {/* Preview toggle - only show when entry has expressions */}
          {hasExpressions && collectionId && (
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={cn(
                'p-2 rounded transition-colors',
                showPreview
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-accent text-muted-foreground'
              )}
              title={showPreview ? 'Hide preview' : 'Show preview'}
            >
              {showPreview ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete}
            className="p-2 hover:bg-destructive/10 hover:text-destructive rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
            title={canDelete ? "Delete entry" : "Cannot delete the last entry"}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile Entry Card Layout */}
      <div className="md:hidden mobile-entry-card">
        {/* Card header with index and expand toggle */}
        <div className="mobile-entry-header">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={!!isExpanded}
            aria-label={`Advanced settings for entry ${index + 1}`}
            className="mobile-action-btn -ml-2 flex gap-1"
          >
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
            <span className="text-xs">Advanced{configured.length ? ` (${configured.length})` : ''}</span>
          </button>
          <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete entry ${index + 1}`}
            disabled={!canDelete}
            className="mobile-action-btn text-muted-foreground disabled:opacity-30"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>

        {/* Card content */}
        <div className="mobile-entry-content">
          {/* Value input - full width */}
          <label className="block">
            <span className="block text-sm font-medium text-muted-foreground mb-1.5">Value</span>
            <HighlightedInput
              ref={mobileInputRef}
              value={entryValue}
              onChange={(value) => updateField('value', value)}
              onKeyDown={handleKeyDown}
              placeholder="Entry value (supports {{...}} templates)"
              className="w-full p-3 border rounded-xl bg-background text-base min-h-[48px]"
              suggestions={suggestions}
              tableMap={tableMap}
              templateMap={templateMap}
              sharedVariables={autocompleteSharedVariables}
            />
          </label>

          {/* Weight/Range row */}
          <div className="flex gap-3">
            {weightMode === 'weight' && !nativeDice ? (
              <div className="flex-1">
                <label htmlFor={`${fieldId}-weight`} className="block text-sm font-medium text-muted-foreground mb-1.5">Weight</label>
                <input id={`${fieldId}-weight`}
                  type="number"
                  value={entry.weight ?? 1}
                  onChange={(e) =>
                    updateField(
                      'weight',
                      e.target.value ? parseFloat(e.target.value) : 1
                    )
                  }
                  min={0}
                  step={0.1}
                  className="w-full p-3 border rounded-xl bg-background text-base text-center min-h-[48px]"
                />
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <label htmlFor={`${fieldId}-range-start`} className="block text-sm font-medium text-muted-foreground mb-1.5">From</label>
                  <input id={`${fieldId}-range-start`}
                    type="number"
                    value={entry.range?.[0] ?? 1}
                    onChange={(e) =>
                      handleRangeChange(0, e.target.value === '' ? 1 : Number(e.target.value))
                    }
                    min={nativeDice ? undefined : 1}
                    className="w-full p-3 border rounded-xl bg-background text-base text-center min-h-[48px]"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor={`${fieldId}-range-end`} className="block text-sm font-medium text-muted-foreground mb-1.5">To</label>
                  <input id={`${fieldId}-range-end`}
                    type="number"
                    value={entry.range?.[1] ?? 1}
                    onChange={(e) =>
                      handleRangeChange(1, e.target.value === '' ? 1 : Number(e.target.value))
                    }
                    min={entry.range?.[0] ?? 1}
                    className="w-full p-3 border rounded-xl bg-background text-base text-center min-h-[48px]"
                  />
                </div>
              </>
            )}

            {/* Preview toggle for mobile */}
            {hasExpressions && collectionId && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  aria-label={showPreview ? 'Hide preview' : 'Show preview'}
                  aria-pressed={showPreview}
                  className={cn(
                    'p-3 rounded-xl transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center',
                    showPreview
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted/50 text-muted-foreground'
                  )}
                >
                  {showPreview ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline Preview */}
      {showPreview && result?.segments && result.segments.length > 0 && (
        <div className="px-3 pb-3">
          {/\{\{\s*@/.test(entryValue) && <p className="text-xs text-muted-foreground mb-2">Roll the full table to evaluate entry sets and @self references.</p>}
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded border border-border/50">
            <div className="flex-1 text-sm">
              <InlineResult segments={result.segments} />
            </div>
            <button
              type="button"
              onClick={reroll}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Re-roll"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t p-4 space-y-4 bg-muted/30">
          {nativeDice && entry.weight !== undefined && <p className="text-sm text-destructive">This entry still has a weight. Choose Range below to remove the weight and use literal dice totals.</p>}
          <p className="text-sm text-muted-foreground">Advanced settings{configured.length ? ` — configured: ${configured.join(', ')}` : ' — optional descriptions, IDs and properties'}</p>
          {/* Clone button in top right */}
          {onClone && (
            <div className="flex justify-end -mt-1 -mb-2">
              <button
                type="button"
                onClick={onClone}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                title="Clone entry"
              >
                <Copy className="h-4 w-4" />
                <span className="hidden sm:inline">Clone</span>
              </button>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor={`${fieldId}-entry-id`} className="block text-sm font-medium mb-1">Entry ID</label>
              <input id={`${fieldId}-entry-id`}
                type="text"
                value={entry.id || ''}
                onChange={(e) => updateField('id', e.target.value || undefined)}
                placeholder="Auto-generated if empty"
                className="w-full p-2 border rounded-md bg-background text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Required for inheritance overrides
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Weight Mode
              </label>
              <div className="flex border rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleWeightModeChange('weight')}
                  aria-pressed={weightMode === 'weight' && !nativeDice}
                  disabled={nativeDice}
                  className={cn(
                    'flex-1 px-3 py-2 text-sm transition-colors',
                    weightMode === 'weight' && !nativeDice
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  Weight
                </button>
                <button
                  type="button"
                  onClick={() => handleWeightModeChange('range')}
                  aria-pressed={weightMode === 'range' || nativeDice}
                  className={cn(
                    'flex-1 px-3 py-2 text-sm transition-colors',
                    weightMode === 'range' || nativeDice
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  Range
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{nativeDice ? 'Source dice use the literal totals in each range. Choosing Range removes an existing weight.' : 'Changing mode replaces this entry’s existing weight or range. In weighted mode, a range contributes its width as weight; it does not roll dice.'}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <PatternPreview
              pattern={entry.description || ''}
              onChange={(description) =>
                updateField('description', description || undefined)
              }
              collectionId={collectionId}
              sharedVariables={sharedVariables}
              placeholder="Optional description (Markdown and patterns supported)"
              minHeight={60}
              hidePreviewWhenEmpty={true}
              hideLabel={true}
              suggestions={suggestions}
              tableMap={tableMap}
              templateMap={templateMap}
              autocompleteSharedVariables={autocompleteSharedVariables}
            />
            {/\{\{\s*@/.test(entry.description || '') && <p className="text-xs text-muted-foreground mt-2">Roll the full table to evaluate entry sets and @self references.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Result Type</label>
            <ResultTypeSelector
              value={entry.resultType ?? undefined}
              onChange={(value) => updateField('resultType', value)}
              placeholder="Override table type..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Sets (Placeholder Values)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Use {'{{pattern}}'} syntax for dynamic values (e.g., {'{{dice:1d6}}'}, {'{{tableName}}'})
            </p>
            <KeyValueEditor
              value={entry.sets || {}}
              onChange={(sets) =>
                updateField('sets', Object.keys(sets).length > 0 ? sets : undefined)
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
              sharedVariables={autocompleteSharedVariables}
              previewSharedVariables={sharedVariables}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Assets</label>
            <KeyValueEditor
              value={entry.assets || {}}
              onChange={(assets) =>
                updateField(
                  'assets',
                  Object.keys(assets).length > 0 ? assets : undefined
                )
              }
              keyPlaceholder="Type (image, token, etc.)"
              valuePlaceholder="Path or URL"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <TagInput
              value={entry.tags || []}
              onChange={(tags) =>
                updateField('tags', tags.length > 0 ? tags : undefined)
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface TagInputProps {
  value: string[]
  onChange: (value: string[]) => void
}

function TagInput({ value, onChange }: TagInputProps) {
  const [input, setInput] = useState('')

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase()
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed])
      }
      setInput('')
    },
    [value, onChange]
  )

  const removeTag = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index))
    },
    [value, onChange]
  )

  return (
    <div className="border rounded-md bg-background p-2">
      <div className="flex flex-wrap gap-2">
        {value.map((tag, index) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-primary/10 text-primary rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              aria-label={`Remove tag ${tag}`}
              className="hover:bg-primary/20 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          aria-label="Entry tags"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag(input)
            } else if (e.key === 'Backspace' && !input && value.length > 0) {
              removeTag(value.length - 1)
            }
          }}
          onBlur={() => input && addTag(input)}
          placeholder={value.length === 0 ? 'Add tags...' : ''}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-sm"
        />
      </div>
    </div>
  )
}

export default EntryEditor
