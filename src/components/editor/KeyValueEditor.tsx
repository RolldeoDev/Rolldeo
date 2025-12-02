/**
 * KeyValueEditor Component
 *
 * Reusable editor for key-value pairs with validation support.
 * Used for variables, shared variables, and other key-value data.
 */

import { useState, useCallback, useRef } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { usePatternEvaluation } from './PatternPreview/usePatternEvaluation'
import { HighlightedInput, type HighlightedInputRef } from './PatternPreview/HighlightedInput'
import { InsertDropdown } from './InsertDropdown'
import { cn } from '@/lib/utils'
import type { TableInfo, TemplateInfo, ImportedTableInfo, ImportedTemplateInfo } from '@/engine/core'

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
  /** Highlight keys starting with $ as capture-aware (content-aware) variables */
  highlightCaptureAware?: boolean
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
  highlightCaptureAware,
  showInsertButton,
  localTables = [],
  localTemplates = [],
  importedTables = [],
  importedTemplates = [],
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
        const isCaptureAware = highlightCaptureAware && displayKey.startsWith('$')
        return (
        <div key={index} className="editor-entry-row flex-col md:flex-row items-stretch md:items-start">
          <div className="flex-1">
            <label className={cn(
              "block md:hidden text-sm font-medium mb-1.5",
              isCaptureAware ? "text-pink" : "text-muted-foreground"
            )}>
              {isCaptureAware ? "Key (capture-aware)" : "Key"}
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
              className={cn(
                "editor-input text-base md:text-sm font-mono min-h-[48px] md:min-h-0",
                isCaptureAware && "capture-aware"
              )}
              placeholder={keyPlaceholder}
              title={isCaptureAware ? "Capture-aware: use {{$" + displayKey.slice(1) + ".@property}} to access sets" : undefined}
            />
            {isCaptureAware && (
              <p className="text-xs text-pink mt-1">
                Captures sets. Access with: <code className="px-1 bg-pink/20 rounded">{`{{${displayKey}.@property}}`}</code>
              </p>
            )}
          </div>
          <div className="flex-1">
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
            {valueSupportsExpressions && val.includes('{{') && (
              <ExpressionPreview value={val} collectionId={collectionId} />
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
        {(() => {
          const newKeyIsCaptureAware = highlightCaptureAware && newKey.startsWith('$')
          return (
        <div className="flex flex-col md:flex-row gap-3 md:gap-2 items-stretch md:items-start">
          <div className="flex-1">
            <label className={cn(
              "block md:hidden text-sm font-medium mb-1.5",
              newKeyIsCaptureAware ? "text-pink" : "text-muted-foreground"
            )}>
              {newKeyIsCaptureAware ? "New Key (capture-aware)" : "New Key"}
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
              className={cn(
                "editor-input text-base md:text-sm font-mono min-h-[48px] md:min-h-0",
                newKeyIsCaptureAware && "capture-aware"
              )}
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
          )
        })()}
        {keyValidationError && (
          <p className="text-sm md:text-xs text-destructive">{keyValidationError}</p>
        )}
      </div>

      {valueSupportsExpressions && (
        <div className="text-sm md:text-xs text-muted-foreground p-4 md:p-3 bg-muted/30 rounded-xl md:rounded-lg space-y-2">
          <p>
            <strong>Tip:</strong> Shared variables support expressions like{' '}
            <code className="px-1.5 md:px-1 py-0.5 bg-muted rounded">{'{{dice:2d6}}'}</code>,{' '}
            <code className="px-1.5 md:px-1 py-0.5 bg-muted rounded">{'{{math:$var + 5}}'}</code>,
            or table references. They're evaluated in order, so later variables can
            reference earlier ones.
          </p>
          {highlightCaptureAware && (
            <p className="text-pink">
              <strong>Capture-aware:</strong> Name starting with{' '}
              <code className="px-1.5 md:px-1 py-0.5 bg-pink/20 rounded">$</code>{' '}
              (e.g., <code className="px-1.5 md:px-1 py-0.5 bg-pink/20 rounded">$hero</code>){' '}
              captures the full roll including sets. Access properties with{' '}
              <code className="px-1.5 md:px-1 py-0.5 bg-pink/20 rounded">{'{{$hero.@property}}'}</code>.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * ExpressionPreview - Shows live preview of expression evaluation
 */
function ExpressionPreview({
  value,
  collectionId,
}: {
  value: string
  collectionId?: string
}) {
  const { result, reroll, isEvaluating } = usePatternEvaluation(value, collectionId, {
    enableTrace: false,
    debounceMs: 300,
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
    <div className="flex items-center gap-1.5 mt-1">
      <span
        className={cn(
          'text-xs',
          hasError ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        → {displayText}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          reroll()
        }}
        className="p-0.5 rounded hover:bg-accent transition-colors"
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
}

export default KeyValueEditor
