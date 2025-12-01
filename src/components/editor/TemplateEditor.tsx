/**
 * TemplateEditor Component
 *
 * Visual editor for template patterns with syntax helper buttons.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Trash2,
  ChevronDown,
  ChevronRight,
  Dices,
  Calculator,
  RefreshCw,
  Variable,
  X,
  Info,
  Grab,
  ListOrdered,
  FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KeyValueEditor } from './KeyValueEditor'
import { InsertDropdown } from './InsertDropdown'
import { PatternPreview, type EditablePatternRef } from './PatternPreview'
import { ResultTypeSelector } from './ResultTypeSelector'
import type { Template, SharedVariables } from '@/engine/types'
import type { ImportedTableInfo, ImportedTemplateInfo } from '@/engine/core'

export interface TemplateEditorProps {
  /** The template to edit */
  template: Template
  /** Called when template changes */
  onChange: (template: Template) => void
  /** Called when template should be deleted */
  onDelete: () => void
  /** Available table IDs for references */
  availableTableIds: string[]
  /** Available template IDs for references */
  availableTemplateIds?: string[]
  /** Tables from imported collections */
  importedTables?: ImportedTableInfo[]
  /** Templates from imported collections */
  importedTemplates?: ImportedTemplateInfo[]
  /** Whether the template card is expanded */
  defaultExpanded?: boolean
  /** Collection ID for live preview evaluation */
  collectionId?: string
  /** Called when any field in the editor gains focus */
  onFocus?: () => void
  /** Called when focus leaves the editor entirely */
  onBlur?: () => void
  /** Called when expansion state changes (isExpanded) */
  onExpandChange?: (isExpanded: boolean) => void
}

export function TemplateEditor({
  template,
  onChange,
  onDelete,
  availableTableIds,
  availableTemplateIds = [],
  importedTables = [],
  importedTemplates = [],
  defaultExpanded = false,
  collectionId,
  onFocus,
  onBlur,
  onExpandChange,
}: TemplateEditorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const patternEditorRef = useRef<EditablePatternRef>(null)
  const prevDefaultExpandedRef = useRef(defaultExpanded)

  // Expand when defaultExpanded transitions from false to true (explicit selection)
  // Don't force open just because defaultExpanded is true - allow user to collapse
  useEffect(() => {
    if (defaultExpanded && !prevDefaultExpandedRef.current) {
      setIsExpanded(true)
      onExpandChange?.(true)
    }
    prevDefaultExpandedRef.current = defaultExpanded
  }, [defaultExpanded, onExpandChange])

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
    <K extends keyof Template>(field: K, value: Template[K]) => {
      onChange({ ...template, [field]: value })
    },
    [template, onChange]
  )

  const insertAtCursor = useCallback(
    (text: string) => {
      if (patternEditorRef.current) {
        patternEditorRef.current.insertAtCursor(text)
      } else {
        // Fallback: append to end
        updateField('pattern', (template.pattern || '') + text)
      }
    },
    [template.pattern, updateField]
  )

  return (
    <div className="border rounded-lg overflow-hidden" onFocus={handleFocus} onBlur={handleBlur}>
      {/* Template Header */}
      <div
        className={cn(
          'flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/50 transition-colors',
          'min-h-[56px] md:min-h-0',
          isExpanded && 'border-b'
        )}
        onClick={handleToggleExpand}
      >
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="font-medium truncate text-base md:text-sm">
            {template.name || 'Untitled Template'}
          </div>
          <span className="text-sm md:text-sm text-muted-foreground">{template.id}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-2 md:p-2 p-3 hover:bg-destructive/10 hover:text-destructive rounded-xl md:rounded transition-colors min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
          title="Delete template"
        >
          <Trash2 className="h-5 w-5 md:h-4 md:w-4" />
        </button>
      </div>

      {/* Template Content */}
      {isExpanded && (
        <div className="p-4 md:p-4 space-y-4 md:space-y-4 mobile-form-container">
          {/* Basic Info */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <div>
              <label className="block text-sm md:text-sm text-base font-medium mb-1 md:mb-1 mb-2">
                Template ID <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={template.id}
                onChange={(e) => updateField('id', e.target.value)}
                placeholder="uniqueTemplateId"
                className="w-full p-3 md:p-2 border rounded-xl md:rounded-md bg-background text-base md:text-sm min-h-[48px] md:min-h-0"
              />
            </div>

            <div>
              <label className="block text-sm md:text-sm text-base font-medium mb-1 md:mb-1 mb-2">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={template.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Template Name"
                className="w-full p-3 md:p-2 border rounded-xl md:rounded-md bg-background text-base md:text-sm min-h-[48px] md:min-h-0"
              />
            </div>

            <div>
              <label className="block text-sm md:text-sm text-base font-medium mb-1 md:mb-1 mb-2">
                Result Type
              </label>
              <ResultTypeSelector
                value={template.resultType}
                onChange={(value) => updateField('resultType', value)}
                placeholder="Select or enter type..."
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm md:text-sm text-base font-medium mb-1 md:mb-1 mb-2">Description</label>
            <input
              type="text"
              value={template.description || ''}
              onChange={(e) =>
                updateField('description', e.target.value || undefined)
              }
              placeholder="Template description"
              className="w-full p-3 md:p-2 border rounded-xl md:rounded-md bg-background text-base md:text-sm min-h-[48px] md:min-h-0"
            />
          </div>

          {/* Shared Variables (collapsible) */}
          <details className="border rounded-lg">
            <summary className="px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors list-none">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Shared Variables</span>
                <span className="text-xs text-muted-foreground">(optional)</span>
                <div className="group relative">
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  <div className="absolute left-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs bg-popover border rounded-md shadow-lg">
                    Template-level shared variables are evaluated lazily when this
                    template is rolled, not when the document loads. They propagate
                    to any nested table references. Cannot shadow document-level
                    variables.
                  </div>
                </div>
              </div>
            </summary>
            <div className="p-4 border-t space-y-3">
              <p className="text-sm text-muted-foreground">
                Variables evaluated when this template is rolled. Available to nested table references.
              </p>
              <KeyValueEditor
                value={(template.shared as SharedVariables) || {}}
                onChange={(shared) =>
                  updateField('shared', Object.keys(shared).length > 0 ? shared : undefined)
                }
                keyPlaceholder="Variable name"
                valuePlaceholder="Value (supports {{dice:}}, {{math:}}, etc.)"
                keyPattern="^[a-zA-Z_][a-zA-Z0-9_]*$"
                keyError="Must start with letter/underscore, alphanumeric only"
                valueSupportsExpressions
                collectionId={collectionId}
              />
            </div>
          </details>

          {/* Pattern Editor with Syntax Helpers */}
          <div>
            <div className="flex items-center mb-2 md:mb-2 mb-3">
              <span className="text-base md:text-sm font-medium">
                Pattern & Preview
              </span>
            </div>

            {/* Quick Syntax Buttons - scrollable on mobile */}
            <div className="flex flex-wrap md:flex-wrap flex-nowrap gap-2 md:gap-1.5 mb-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <InsertDropdown
                availableTableIds={availableTableIds}
                availableTemplateIds={availableTemplateIds.filter(id => id !== template.id)}
                importedTables={importedTables}
                importedTemplates={importedTemplates.filter(t => t.id !== template.id)}
                onInsert={insertAtCursor}
              />
              <SyntaxHelperButton
                icon={<Dices className="h-3.5 w-3.5" />}
                label="Dice"
                title="Insert dice roll"
                onClick={() => insertAtCursor('{{dice:2d6}}')}
              />
              <SyntaxHelperButton
                icon={<Calculator className="h-3.5 w-3.5" />}
                label="Math"
                title="Insert math expression"
                onClick={() => insertAtCursor('{{math:1 + 2}}')}
              />
              <SyntaxHelperButton
                icon={<Variable className="h-3.5 w-3.5" />}
                label="Variable"
                title="Insert variable reference"
                onClick={() => insertAtCursor('{{$variableName}}')}
              />
              <SyntaxHelperButton
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                label="Again"
                title="Insert re-roll reference"
                onClick={() => insertAtCursor('{{again}}')}
              />
              <SyntaxHelperButton
                label="@placeholder"
                title="Insert placeholder reference"
                onClick={() => insertAtCursor('{{@placeholderName}}')}
              />
              <SyntaxHelperButton
                label="unique:N"
                title="Insert unique selection"
                onClick={() => {
                  const tableId =
                    availableTableIds.length > 0 ? availableTableIds[0] : 'tableId'
                  insertAtCursor(`{{unique:3:${tableId}}}`)
                }}
              />
              <span className="w-px h-4 bg-border mx-1" />
              <SyntaxHelperButton
                icon={<Grab className="h-3.5 w-3.5" />}
                label="Capture"
                title="Insert capture multi-roll (stores results in variable)"
                onClick={() => {
                  const tableId =
                    availableTableIds.length > 0 ? availableTableIds[0] : 'tableId'
                  insertAtCursor(`{{3*${tableId} >> $items}}`)
                }}
              />
              <SyntaxHelperButton
                icon={<ListOrdered className="h-3.5 w-3.5" />}
                label="$var[n]"
                title="Insert capture access (get item by index)"
                onClick={() => insertAtCursor('{{$items[0]}}')}
              />
              <SyntaxHelperButton
                icon={<FolderOpen className="h-3.5 w-3.5" />}
                label="collect:"
                title="Insert collect expression (aggregate property from captures)"
                onClick={() => insertAtCursor('{{collect:$items.@value|unique}}')}
              />
            </div>

            {/* New Unified Pattern Preview with editable pattern */}
            <PatternPreview
              ref={patternEditorRef}
              pattern={template.pattern || ''}
              onChange={(pattern) => updateField('pattern', pattern)}
              collectionId={collectionId}
              availableTableIds={availableTableIds}
              availableTemplateIds={availableTemplateIds.filter(id => id !== template.id)}
              sharedVariables={template.shared as Record<string, string> | undefined}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-base md:text-sm font-medium mb-2 md:mb-1">Tags</label>
            <TagInput
              value={template.tags || []}
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

interface SyntaxHelperButtonProps {
  icon?: React.ReactNode
  label: string
  title: string
  onClick: () => void
}

function SyntaxHelperButton({
  icon,
  label,
  title,
  onClick,
}: SyntaxHelperButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 px-3 md:px-2.5 py-2 md:py-1 text-sm md:text-xs border rounded-xl md:rounded-md hover:bg-accent active:bg-accent/70 transition-colors flex-shrink-0 min-h-[40px] md:min-h-0"
    >
      {icon}
      {label}
    </button>
  )
}

// ============================================================================
// Tag Input Component
// ============================================================================

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
          className="flex-1 min-w-[100px] bg-transparent outline-none text-base md:text-sm py-1 md:py-0"
        />
      </div>
    </div>
  )
}

export default TemplateEditor
