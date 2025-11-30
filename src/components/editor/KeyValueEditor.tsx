/**
 * KeyValueEditor Component
 *
 * Reusable editor for key-value pairs with validation support.
 * Used for variables, shared variables, and other key-value data.
 */

import { useState, useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'

export interface KeyValueEditorProps {
  value: Record<string, string>
  onChange: (value: Record<string, string>) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  keyPattern?: string
  keyError?: string
  valueSupportsExpressions?: boolean
}

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  keyPattern,
  keyError,
  valueSupportsExpressions,
}: KeyValueEditorProps) {
  const entries = Object.entries(value)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [keyValidationError, setKeyValidationError] = useState<string | null>(null)

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

  const updateEntryKey = useCallback(
    (oldKey: string, newKey: string) => {
      const trimmedKey = newKey.trim()
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

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
          No variables defined. Add one below.
        </div>
      )}

      {entries.map(([key, val]) => (
        <div key={key} className="flex gap-2 items-start">
          <div className="flex-1">
            <input
              type="text"
              value={key}
              onChange={(e) => updateEntryKey(key, e.target.value)}
              className="w-full p-2 border rounded-md bg-background text-sm font-mono"
              placeholder={keyPlaceholder}
            />
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={val}
              onChange={(e) => updateEntryValue(key, e.target.value)}
              className="w-full p-2 border rounded-md bg-background text-sm"
              placeholder={valuePlaceholder}
            />
            {valueSupportsExpressions && val.includes('{{') && (
              <p className="text-xs text-muted-foreground mt-1">
                Expression detected
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => removeEntry(key)}
            className="p-2 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
            title="Delete variable"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {/* Add new entry */}
      <div className="pt-2 border-t space-y-2">
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <input
              type="text"
              value={newKey}
              onChange={(e) => {
                setNewKey(e.target.value)
                setKeyValidationError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && addEntry()}
              className="w-full p-2 border rounded-md bg-background text-sm font-mono"
              placeholder={keyPlaceholder}
            />
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEntry()}
              className="w-full p-2 border rounded-md bg-background text-sm"
              placeholder={valuePlaceholder}
            />
          </div>
          <button
            type="button"
            onClick={addEntry}
            disabled={!newKey.trim()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {keyValidationError && (
          <p className="text-xs text-destructive">{keyValidationError}</p>
        )}
      </div>

      {valueSupportsExpressions && (
        <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
          <strong>Tip:</strong> Shared variables support expressions like{' '}
          <code className="px-1 py-0.5 bg-muted rounded">{'{{dice:2d6}}'}</code>,{' '}
          <code className="px-1 py-0.5 bg-muted rounded">{'{{math:$var + 5}}'}</code>,
          or table references. They're evaluated in order, so later variables can
          reference earlier ones.
        </div>
      )}
    </div>
  )
}

export default KeyValueEditor
