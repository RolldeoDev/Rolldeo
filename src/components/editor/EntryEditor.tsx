/**
 * EntryEditor Component
 *
 * Editor for individual table entries in simple tables.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Trash2, X, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { extractExpressions } from '@/engine/core/parser'
import { InlineResult } from './PatternPreview/InlineResult'
import { PatternPreview } from './PatternPreview/PatternPreview'
import { usePatternEvaluation } from './PatternPreview/usePatternEvaluation'
import type { Entry } from '@/engine/types'

export interface EntryEditorProps {
  /** The entry to edit */
  entry: Entry
  /** Called when entry changes */
  onChange: (entry: Entry) => void
  /** Called when entry should be deleted */
  onDelete: () => void
  /** Called when Enter is pressed on a valid entry to add a new one */
  onAddEntry?: () => void
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
}

export function EntryEditor({
  entry,
  onChange,
  onDelete,
  onAddEntry,
  index,
  isDragging,
  canDelete = true,
  collectionId,
  autoFocus = false,
}: EntryEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [weightMode, setWeightMode] = useState<'weight' | 'range'>(
    entry.range ? 'range' : 'weight'
  )
  const valueInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the value input when requested
  useEffect(() => {
    if (autoFocus && valueInputRef.current) {
      valueInputRef.current.focus()
    }
  }, [autoFocus])

  // Check if entry value contains expressions
  const hasExpressions = useMemo(() => {
    return extractExpressions(entry.value).length > 0
  }, [entry.value])

  // Evaluate for preview (only when preview is shown)
  const { result, reroll } = usePatternEvaluation(
    showPreview ? entry.value : '',
    collectionId,
    { enableTrace: false, debounceMs: 200 }
  )

  const updateField = useCallback(
    <K extends keyof Entry>(field: K, value: Entry[K]) => {
      const updated = { ...entry, [field]: value }
      // Remove undefined/empty values
      if (value === undefined || value === '') {
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
        updated.range = [1, 1]
        onChange(updated)
      }
    },
    [entry, onChange]
  )

  const handleRangeChange = useCallback(
    (index: 0 | 1, value: number) => {
      const range = [...(entry.range || [1, 1])] as [number, number]
      range[index] = value
      updateField('range', range)
    },
    [entry.range, updateField]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && entry.value.trim() && onAddEntry) {
        e.preventDefault()
        onAddEntry()
      }
    },
    [entry.value, onAddEntry]
  )

  return (
    <div
      className={cn(
        'border rounded-lg transition-shadow',
        isDragging && 'shadow-lg bg-background'
      )}
    >
      {/* Entry Header */}
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-accent rounded"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <span className="text-sm text-muted-foreground w-8">#{index + 1}</span>

        <input
          ref={valueInputRef}
          type="text"
          value={entry.value}
          onChange={(e) => updateField('value', e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Entry value (supports {{...}} templates)"
          className="flex-1 p-2 border rounded-md bg-background text-sm"
        />

        <div className="flex items-center gap-2">
          {weightMode === 'weight' ? (
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
            />
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={entry.range?.[0] ?? 1}
                onChange={(e) =>
                  handleRangeChange(0, parseInt(e.target.value, 10) || 1)
                }
                min={1}
                className="w-12 p-2 border rounded-md bg-background text-sm text-center"
                title="Range start"
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="number"
                value={entry.range?.[1] ?? 1}
                onChange={(e) =>
                  handleRangeChange(1, parseInt(e.target.value, 10) || 1)
                }
                min={entry.range?.[0] ?? 1}
                className="w-12 p-2 border rounded-md bg-background text-sm text-center"
                title="Range end"
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

      {/* Inline Preview */}
      {showPreview && result?.segments && result.segments.length > 0 && (
        <div className="px-3 pb-3">
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
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Entry ID</label>
              <input
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
                  className={cn(
                    'flex-1 px-3 py-2 text-sm transition-colors',
                    weightMode === 'weight'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  Weight
                </button>
                <button
                  type="button"
                  onClick={() => handleWeightModeChange('range')}
                  className={cn(
                    'flex-1 px-3 py-2 text-sm transition-colors',
                    weightMode === 'range'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  Range
                </button>
              </div>
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
              placeholder="Optional description (Markdown and patterns supported)"
              minHeight={60}
              hidePreviewWhenEmpty={true}
              hideLabel={true}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Result Type</label>
            <input
              type="text"
              value={entry.resultType || ''}
              onChange={(e) =>
                updateField('resultType', e.target.value || undefined)
              }
              placeholder="creature, item, location, etc."
              className="w-full p-2 border rounded-md bg-background text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Sets (Placeholder Values)
            </label>
            <KeyValueEditor
              value={entry.sets || {}}
              onChange={(sets) =>
                updateField('sets', Object.keys(sets).length > 0 ? sets : undefined)
              }
              keyPlaceholder="Key (@key)"
              valuePlaceholder="Value"
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

interface KeyValueEditorProps {
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}

function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: KeyValueEditorProps) {
  const entries = Object.entries(value)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const addEntry = useCallback(() => {
    if (newKey.trim() && newValue.trim()) {
      onChange({ ...value, [newKey.trim()]: newValue.trim() })
      setNewKey('')
      setNewValue('')
    }
  }, [value, onChange, newKey, newValue])

  const removeEntry = useCallback(
    (key: string) => {
      const updated = { ...value }
      delete updated[key]
      onChange(updated)
    },
    [value, onChange]
  )

  const updateEntry = useCallback(
    (oldKey: string, newKey: string, newValue: string) => {
      const updated: Record<string, string> = {}
      for (const [k, v] of Object.entries(value)) {
        if (k === oldKey) {
          if (newKey.trim()) {
            updated[newKey.trim()] = newValue
          }
        } else {
          updated[k] = v
        }
      }
      onChange(updated)
    },
    [value, onChange]
  )

  return (
    <div className="space-y-2">
      {entries.map(([key, val]) => (
        <div key={key} className="flex gap-2">
          <input
            type="text"
            value={key}
            onChange={(e) => updateEntry(key, e.target.value, val)}
            className="flex-1 p-2 border rounded-md bg-background text-sm"
            placeholder={keyPlaceholder}
          />
          <input
            type="text"
            value={val}
            onChange={(e) => updateEntry(key, key, e.target.value)}
            className="flex-1 p-2 border rounded-md bg-background text-sm"
            placeholder={valuePlaceholder}
          />
          <button
            type="button"
            onClick={() => removeEntry(key)}
            className="p-2 hover:bg-destructive/10 hover:text-destructive rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addEntry()}
          className="flex-1 p-2 border rounded-md bg-background text-sm"
          placeholder={keyPlaceholder}
        />
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addEntry()}
          className="flex-1 p-2 border rounded-md bg-background text-sm"
          placeholder={valuePlaceholder}
        />
        <button
          type="button"
          onClick={addEntry}
          disabled={!newKey.trim() || !newValue.trim()}
          className="px-3 py-2 text-sm border rounded-md hover:bg-accent disabled:opacity-50"
        >
          Add
        </button>
      </div>
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
              className="hover:bg-primary/20 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
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
