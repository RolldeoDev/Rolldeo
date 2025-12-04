/**
 * MetadataEditor Component
 *
 * Visual editor for Random Table Spec metadata fields.
 */

import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  Metadata,
  MetadataSource,
  Rights,
  RightsPermissions,
  RightsContact,
  StructuredCopyright,
} from '@/engine/types'

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
  const [showRights, setShowRights] = useState(!!value.rights)
  const [useStructuredCopyright, setUseStructuredCopyright] = useState(
    typeof value.source?.copyright === 'object'
  )

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

  const updateStructuredCopyright = useCallback(
    <K extends keyof StructuredCopyright>(field: K, fieldValue: StructuredCopyright[K]) => {
      const currentCopyright = typeof value.source?.copyright === 'object'
        ? value.source.copyright
        : {}
      onChange({
        ...value,
        source: {
          ...(value.source || {}),
          copyright: { ...currentCopyright, [field]: fieldValue },
        },
      })
    },
    [value, onChange]
  )

  const updateRights = useCallback(
    <K extends keyof Rights>(field: K, fieldValue: Rights[K]) => {
      onChange({
        ...value,
        rights: { ...(value.rights || {}), [field]: fieldValue },
      })
    },
    [value, onChange]
  )

  const updatePermissions = useCallback(
    <K extends keyof RightsPermissions>(field: K, fieldValue: RightsPermissions[K]) => {
      onChange({
        ...value,
        rights: {
          ...(value.rights || {}),
          permissions: { ...(value.rights?.permissions || {}), [field]: fieldValue },
        },
      })
    },
    [value, onChange]
  )

  const updateContact = useCallback(
    <K extends keyof RightsContact>(field: K, fieldValue: RightsContact[K]) => {
      onChange({
        ...value,
        rights: {
          ...(value.rights || {}),
          contact: { ...(value.rights?.contact || {}), [field]: fieldValue },
        },
      })
    },
    [value, onChange]
  )

  // Helper to get copyright as string (for simple mode)
  const getCopyrightString = (): string => {
    if (!value.source?.copyright) return ''
    if (typeof value.source.copyright === 'string') return value.source.copyright
    return value.source.copyright.notice || ''
  }

  // Helper to get structured copyright
  const getStructuredCopyright = (): StructuredCopyright => {
    if (!value.source?.copyright) return {}
    if (typeof value.source.copyright === 'object') return value.source.copyright
    return { notice: value.source.copyright }
  }

  return (
    <div className="space-y-6 mobile-form-container">
      {/* Required Fields */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
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
              'w-full p-3 md:p-2 border rounded-xl md:rounded-md bg-background text-base md:text-sm min-h-[48px] md:min-h-0',
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
              'w-full p-3 md:p-2 border rounded-xl md:rounded-md bg-background text-base md:text-sm min-h-[48px] md:min-h-0',
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
              'w-full p-3 md:p-2 border rounded-xl md:rounded-md bg-background text-base md:text-sm min-h-[48px] md:min-h-0',
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
            className="w-full p-3 md:p-2 border rounded-xl md:rounded-md bg-background text-base md:text-sm min-h-[48px] md:min-h-0"
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
          className="w-full p-3 md:p-2 border rounded-xl md:rounded-md bg-background resize-y text-base md:text-sm"
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
          className="w-full p-3 md:p-2 border rounded-xl md:rounded-md bg-background resize-y text-base md:text-sm"
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

            <FormField label="Pages" description="Page number(s) or range">
              <input
                type="text"
                value={value.source?.pages || ''}
                onChange={(e) => updateSource('pages', e.target.value)}
                placeholder="47-89"
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
          </div>

          {/* Copyright Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Copyright</span>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={useStructuredCopyright}
                  onChange={(e) => {
                    setUseStructuredCopyright(e.target.checked)
                    if (!e.target.checked && typeof value.source?.copyright === 'object') {
                      // Convert structured to simple
                      updateSource('copyright', value.source.copyright.notice || '')
                    }
                  }}
                  className="rounded"
                />
                Structured format
              </label>
            </div>

            {useStructuredCopyright ? (
              <div className="grid gap-4 md:grid-cols-3">
                <FormField label="Year" description="e.g., 2024 or 2020-2024">
                  <input
                    type="text"
                    value={getStructuredCopyright().year || ''}
                    onChange={(e) => updateStructuredCopyright('year', e.target.value)}
                    placeholder="2024"
                    className="w-full p-2 border rounded-md bg-background"
                  />
                </FormField>

                <FormField label="Holder" description="Legal entity name">
                  <input
                    type="text"
                    value={getStructuredCopyright().holder || ''}
                    onChange={(e) => updateStructuredCopyright('holder', e.target.value)}
                    placeholder="Example Games LLC"
                    className="w-full p-2 border rounded-md bg-background"
                  />
                </FormField>

                <FormField label="Notice" description="Full copyright text">
                  <input
                    type="text"
                    value={getStructuredCopyright().notice || ''}
                    onChange={(e) => updateStructuredCopyright('notice', e.target.value)}
                    placeholder="© 2024 Example Games LLC"
                    className="w-full p-2 border rounded-md bg-background"
                  />
                </FormField>
              </div>
            ) : (
              <FormField label="" description="Simple copyright notice">
                <input
                  type="text"
                  value={getCopyrightString()}
                  onChange={(e) => updateSource('copyright', e.target.value)}
                  placeholder="© 2024 Author Name. All rights reserved."
                  className="w-full p-2 border rounded-md bg-background"
                />
              </FormField>
            )}
          </div>
        </div>
      </details>

      {/* Rights & Permissions */}
      <details
        className="border rounded-lg"
        open={showRights}
        onToggle={(e) => setShowRights((e.target as HTMLDetailsElement).open)}
      >
        <summary className="px-4 py-2 cursor-pointer font-medium hover:bg-accent/50 rounded-lg">
          Rights & Permissions
        </summary>
        <div className="p-4 border-t space-y-6">
          {/* Rights Declaration */}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Content Type" description="How is this content classified?">
              <select
                value={value.rights?.type || ''}
                onChange={(e) => updateRights('type', e.target.value as Rights['type'] || undefined)}
                className="w-full p-2 border rounded-md bg-background"
              >
                <option value="">Not specified</option>
                <option value="proprietary">Proprietary (all rights reserved)</option>
                <option value="open-content">Open Content (OGL, CC, etc.)</option>
                <option value="fan-content">Fan Content (community policy)</option>
                <option value="licensed">Licensed (third-party license)</option>
              </select>
            </FormField>

            <FormField label="Official Content" description="Is this official publisher content?">
              <div className="flex items-center gap-3 h-10">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value.rights?.official || false}
                    onChange={(e) => updateRights('official', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">This is official publisher content</span>
                </label>
              </div>
            </FormField>
          </div>

          {/* Product Identity & Trademarks */}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Product Identity"
              description="Protected names, characters, logos (press Enter to add)"
            >
              <TagInput
                value={value.rights?.productIdentity || []}
                onChange={(tags) => updateRights('productIdentity', tags)}
                placeholder="Add protected element..."
              />
            </FormField>

            <FormField
              label="Trademarks"
              description="Trademark notices (press Enter to add)"
            >
              <TagInput
                value={value.rights?.trademarks || []}
                onChange={(tags) => updateRights('trademarks', tags)}
                placeholder="Add trademark..."
              />
            </FormField>
          </div>

          {/* Compatibility Notice */}
          <FormField
            label="Compatibility Notice"
            description="Required non-affiliation statement"
          >
            <textarea
              value={value.rights?.compatibilityNotice || ''}
              onChange={(e) => updateRights('compatibilityNotice', e.target.value)}
              placeholder="Compatible with 5th Edition fantasy roleplaying. Not affiliated with or endorsed by..."
              rows={2}
              className="w-full p-2 border rounded-md bg-background resize-y"
            />
          </FormField>

          {/* Permissions */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Usage Permissions</h4>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <PermissionCheckbox
                label="Commercial Use"
                description="May be used in commercial products"
                checked={value.rights?.permissions?.commercialUse || false}
                onChange={(checked) => updatePermissions('commercialUse', checked)}
              />
              <PermissionCheckbox
                label="Modification"
                description="May be modified or adapted"
                checked={value.rights?.permissions?.modification || false}
                onChange={(checked) => updatePermissions('modification', checked)}
              />
              <PermissionCheckbox
                label="Redistribution"
                description="May be redistributed"
                checked={value.rights?.permissions?.redistribution || false}
                onChange={(checked) => updatePermissions('redistribution', checked)}
              />
              <PermissionCheckbox
                label="Derivative Works"
                description="Derivative works may be created"
                checked={value.rights?.permissions?.derivativeWorks || false}
                onChange={(checked) => updatePermissions('derivativeWorks', checked)}
              />
              <PermissionCheckbox
                label="Attribution Required"
                description="Must credit the copyright holder"
                checked={value.rights?.permissions?.attributionRequired ?? true}
                onChange={(checked) => updatePermissions('attributionRequired', checked)}
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Legal Contact</h4>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Licensing" description="For licensing inquiries">
                <input
                  type="text"
                  value={value.rights?.contact?.licensing || ''}
                  onChange={(e) => updateContact('licensing', e.target.value)}
                  placeholder="licensing@example.com"
                  className="w-full p-2 border rounded-md bg-background"
                />
              </FormField>

              <FormField label="DMCA" description="For takedown requests">
                <input
                  type="text"
                  value={value.rights?.contact?.dmca || ''}
                  onChange={(e) => updateContact('dmca', e.target.value)}
                  placeholder="dmca@example.com"
                  className="w-full p-2 border rounded-md bg-background"
                />
              </FormField>

              <FormField label="General" description="General legal contact">
                <input
                  type="text"
                  value={value.rights?.contact?.general || ''}
                  onChange={(e) => updateContact('general', e.target.value)}
                  placeholder="legal@example.com"
                  className="w-full p-2 border rounded-md bg-background"
                />
              </FormField>
            </div>
          </div>

          {/* Terms URLs */}
          <div className="border-t pt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Terms URL" description="Link to full terms of use">
                <input
                  type="url"
                  value={value.rights?.termsUrl || ''}
                  onChange={(e) => updateRights('termsUrl', e.target.value)}
                  placeholder="https://example.com/terms"
                  className="w-full p-2 border rounded-md bg-background"
                />
              </FormField>

              <FormField label="Community Policy URL" description="Link to fan content policy">
                <input
                  type="url"
                  value={value.rights?.communityPolicyUrl || ''}
                  onChange={(e) => updateRights('communityPolicyUrl', e.target.value)}
                  placeholder="https://example.com/community-use"
                  className="w-full p-2 border rounded-md bg-background"
                />
              </FormField>
            </div>
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
      <label className="block text-base md:text-sm font-medium mb-2 md:mb-1">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {description && !error && (
        <p className="text-sm md:text-xs text-muted-foreground mt-1.5 md:mt-1">{description}</p>
      )}
      {error && <p className="text-sm md:text-xs text-destructive mt-1.5 md:mt-1">{error}</p>}
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
    <div className="border rounded-xl md:rounded-md bg-background p-3 md:p-2">
      <div className="flex flex-wrap gap-2">
        {value.map((tag, index) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 px-3 md:px-2 py-1.5 md:py-0.5 text-sm bg-primary/10 text-primary rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="hover:bg-primary/20 rounded-full p-1 md:p-0.5 min-w-[24px] min-h-[24px] md:min-w-0 md:min-h-0 flex items-center justify-center"
            >
              <X className="h-3.5 w-3.5 md:h-3 md:w-3" />
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
          className="flex-1 min-w-[100px] bg-transparent outline-none text-base md:text-sm py-1 md:py-0"
        />
      </div>
    </div>
  )
}

interface PermissionCheckboxProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function PermissionCheckbox({
  label,
  description,
  checked,
  onChange,
}: PermissionCheckboxProps) {
  return (
    <label className="flex items-start gap-3 p-4 md:p-3 rounded-xl md:rounded-lg border hover:bg-accent/30 active:bg-accent/50 cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded w-5 h-5 md:w-4 md:h-4"
      />
      <div>
        <div className="text-base md:text-sm font-medium">{label}</div>
        <div className="text-sm md:text-xs text-muted-foreground">{description}</div>
      </div>
    </label>
  )
}

export default MetadataEditor
