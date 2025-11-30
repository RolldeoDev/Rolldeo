/**
 * MetadataEditor Component
 *
 * Visual editor for Random Table Spec metadata fields.
 */

import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Metadata, MetadataSource } from '@/engine/types'

export interface MetadataEditorProps {
  /** The metadata object to edit */
  value: Metadata
  /** Called when metadata changes */
  onChange: (value: Metadata) => void
  /** Validation errors keyed by field name */
  errors?: Record<string, string>
}

export function MetadataEditor({
  value,
  onChange,
  errors = {},
}: MetadataEditorProps) {
  const [showSource, setShowSource] = useState(!!value.source)

  const updateField = useCallback(
    <K extends keyof Metadata>(field: K, fieldValue: Metadata[K]) => {
      onChange({ ...value, [field]: fieldValue })
    },
    [value, onChange]
  )

  const updateSource = useCallback(
    <K extends keyof MetadataSource>(field: K, fieldValue: MetadataSource[K]) => {
      onChange({
        ...value,
        source: { ...(value.source || {}), [field]: fieldValue },
      })
    },
    [value, onChange]
  )

  return (
    <div className="space-y-6">
      {/* Required Fields */}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label="Name"
          required
          error={errors.name}
          description="Display name for this collection"
        >
          <input
            type="text"
            value={value.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="My Table Collection"
            className={cn(
              'w-full p-2 border rounded-md bg-background',
              errors.name && 'border-destructive'
            )}
          />
        </FormField>

        <FormField
          label="Namespace"
          required
          error={errors.namespace}
          description="Unique identifier (e.g., fantasy.core)"
        >
          <input
            type="text"
            value={value.namespace || ''}
            onChange={(e) => updateField('namespace', e.target.value)}
            placeholder="myproject.tables"
            className={cn(
              'w-full p-2 border rounded-md bg-background',
              errors.namespace && 'border-destructive'
            )}
          />
        </FormField>

        <FormField
          label="Version"
          required
          error={errors.version}
          description="Semantic version (e.g., 1.0.0)"
        >
          <input
            type="text"
            value={value.version || ''}
            onChange={(e) => updateField('version', e.target.value)}
            placeholder="1.0.0"
            className={cn(
              'w-full p-2 border rounded-md bg-background',
              errors.version && 'border-destructive'
            )}
          />
        </FormField>

        <FormField
          label="Author"
          description="Your name or organization"
        >
          <input
            type="text"
            value={value.author || ''}
            onChange={(e) => updateField('author', e.target.value)}
            placeholder="Your Name"
            className="w-full p-2 border rounded-md bg-background"
          />
        </FormField>
      </div>

      {/* Description */}
      <FormField
        label="Description"
        description="Markdown-formatted description of this collection"
      >
        <textarea
          value={value.description || ''}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="A collection of random tables for..."
          rows={3}
          className="w-full p-2 border rounded-md bg-background resize-y"
        />
      </FormField>

      {/* Instructions */}
      <FormField
        label="Instructions"
        description="Usage instructions in Markdown format"
      >
        <textarea
          value={value.instructions || ''}
          onChange={(e) => updateField('instructions', e.target.value)}
          placeholder="How to use these tables..."
          rows={3}
          className="w-full p-2 border rounded-md bg-background resize-y"
        />
      </FormField>

      {/* Tags */}
      <FormField
        label="Tags"
        description="Categorization tags (press Enter to add)"
      >
        <TagInput
          value={value.tags || []}
          onChange={(tags) => updateField('tags', tags)}
          placeholder="Add a tag..."
        />
      </FormField>

      {/* Advanced Settings */}
      <details className="border rounded-lg">
        <summary className="px-4 py-2 cursor-pointer font-medium hover:bg-accent/50 rounded-lg">
          Advanced Settings
        </summary>
        <div className="p-4 border-t space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              label="Max Recursion Depth"
              description="Limit for nested table references"
            >
              <input
                type="number"
                value={value.maxRecursionDepth ?? 50}
                onChange={(e) =>
                  updateField(
                    'maxRecursionDepth',
                    e.target.value ? parseInt(e.target.value, 10) : undefined
                  )
                }
                min={1}
                className="w-full p-2 border rounded-md bg-background"
              />
            </FormField>

            <FormField
              label="Max Exploding Dice"
              description="Limit for exploding dice re-rolls"
            >
              <input
                type="number"
                value={value.maxExplodingDice ?? 100}
                onChange={(e) =>
                  updateField(
                    'maxExplodingDice',
                    e.target.value ? parseInt(e.target.value, 10) : undefined
                  )
                }
                min={1}
                className="w-full p-2 border rounded-md bg-background"
              />
            </FormField>

            <FormField
              label="Max Inheritance Depth"
              description="Limit for inheritance chains"
            >
              <input
                type="number"
                value={value.maxInheritanceDepth ?? 5}
                onChange={(e) =>
                  updateField(
                    'maxInheritanceDepth',
                    e.target.value ? parseInt(e.target.value, 10) : undefined
                  )
                }
                min={1}
                className="w-full p-2 border rounded-md bg-background"
              />
            </FormField>
          </div>

          <FormField
            label="Unique Overflow Behavior"
            description="What to do when unique selection exceeds available entries"
          >
            <select
              value={value.uniqueOverflowBehavior || 'stop'}
              onChange={(e) =>
                updateField(
                  'uniqueOverflowBehavior',
                  e.target.value as 'stop' | 'cycle' | 'error'
                )
              }
              className="w-full p-2 border rounded-md bg-background"
            >
              <option value="stop">Stop (return fewer results)</option>
              <option value="cycle">Cycle (allow duplicates)</option>
              <option value="error">Error (throw exception)</option>
            </select>
          </FormField>
        </div>
      </details>

      {/* Source Attribution */}
      <details
        className="border rounded-lg"
        open={showSource}
        onToggle={(e) => setShowSource((e.target as HTMLDetailsElement).open)}
      >
        <summary className="px-4 py-2 cursor-pointer font-medium hover:bg-accent/50 rounded-lg">
          Source Attribution
        </summary>
        <div className="p-4 border-t space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Book" description="Source book name">
              <input
                type="text"
                value={value.source?.book || ''}
                onChange={(e) => updateSource('book', e.target.value)}
                placeholder="Core Rulebook"
                className="w-full p-2 border rounded-md bg-background"
              />
            </FormField>

            <FormField label="Publisher" description="Publisher name">
              <input
                type="text"
                value={value.source?.publisher || ''}
                onChange={(e) => updateSource('publisher', e.target.value)}
                placeholder="Publisher Name"
                className="w-full p-2 border rounded-md bg-background"
              />
            </FormField>

            <FormField label="ISBN" description="ISBN if applicable">
              <input
                type="text"
                value={value.source?.isbn || ''}
                onChange={(e) => updateSource('isbn', e.target.value)}
                placeholder="978-0-123456-78-9"
                className="w-full p-2 border rounded-md bg-background"
              />
            </FormField>

            <FormField label="URL" description="URL to source">
              <input
                type="url"
                value={value.source?.url || ''}
                onChange={(e) => updateSource('url', e.target.value)}
                placeholder="https://..."
                className="w-full p-2 border rounded-md bg-background"
              />
            </FormField>

            <FormField label="License" description="Content license">
              <input
                type="text"
                value={value.source?.license || ''}
                onChange={(e) => updateSource('license', e.target.value)}
                placeholder="CC BY 4.0"
                className="w-full p-2 border rounded-md bg-background"
              />
            </FormField>

            <FormField label="Copyright" description="Copyright notice">
              <input
                type="text"
                value={value.source?.copyright || ''}
                onChange={(e) => updateSource('copyright', e.target.value)}
                placeholder="(c) 2024 Author Name"
                className="w-full p-2 border rounded-md bg-background"
              />
            </FormField>
          </div>
        </div>
      </details>
    </div>
  )
}

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  description?: string
  children: React.ReactNode
}

function FormField({
  label,
  required,
  error,
  description,
  children,
}: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {description && !error && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}

interface TagInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}

function TagInput({ value, onChange, placeholder }: TagInputProps) {
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        addTag(input)
      } else if (e.key === 'Backspace' && !input && value.length > 0) {
        removeTag(value.length - 1)
      }
    },
    [input, value, addTag, removeTag]
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
          onKeyDown={handleKeyDown}
          onBlur={() => input && addTag(input)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-sm"
        />
      </div>
    </div>
  )
}

export default MetadataEditor
