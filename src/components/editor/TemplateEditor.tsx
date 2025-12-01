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
  Table2,
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
import type { Template, SharedVariables } from '@/engine/types'

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
  /** Whether the template card is expanded */
  defaultExpanded?: boolean
  /** Collection ID for live preview evaluation */
  collectionId?: string
}

export function TemplateEditor({
  template,
  onChange,
  onDelete,
  availableTableIds,
  availableTemplateIds = [],
  defaultExpanded = false,
  collectionId,
}: TemplateEditorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const patternEditorRef = useRef<EditablePatternRef>(null)

  // Expand when this item becomes selected (defaultExpanded becomes true)
  useEffect(() => {
    if (defaultExpanded) {
      setIsExpanded(true)
    }
  }, [defaultExpanded])

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
    <div className="border rounded-lg overflow-hidden">
      {/* Template Header */}
      <div
        className={cn(
          'flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/50 transition-colors',
          isExpanded && 'border-b'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}

        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {template.name || 'Untitled Template'}
          </div>
          <span className="text-sm text-muted-foreground">{template.id}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-2 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
          title="Delete template"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Template Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Basic Info */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Template ID <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={template.id}
                onChange={(e) => updateField('id', e.target.value)}
                placeholder="uniqueTemplateId"
                className="w-full p-2 border rounded-md bg-background text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={template.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Template Name"
                className="w-full p-2 border rounded-md bg-background text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Result Type
              </label>
              <input
                type="text"
                value={template.resultType || ''}
                onChange={(e) =>
                  updateField('resultType', e.target.value || undefined)
                }
                placeholder="encounter, description, etc."
                className="w-full p-2 border rounded-md bg-background text-sm"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={template.description || ''}
              onChange={(e) =>
                updateField('description', e.target.value || undefined)
              }
              placeholder="Template description"
              className="w-full p-2 border rounded-md bg-background text-sm"
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
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Pattern & Preview
              </span>
              <InsertDropdown
                availableTableIds={availableTableIds}
                availableTemplateIds={availableTemplateIds.filter(id => id !== template.id)}
                onInsert={insertAtCursor}
              />
            </div>

            {/* Quick Syntax Buttons */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <SyntaxHelperButton
                icon={<Table2 className="h-3.5 w-3.5" />}
                label="Table"
                title="Insert table reference"
                onClick={() => {
                  const tableId =
                    availableTableIds.length > 0 ? availableTableIds[0] : 'tableId'
                  insertAtCursor(`{{${tableId}}}`)
                }}
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
            <label className="block text-sm font-medium mb-1">Tags</label>
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
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded-md hover:bg-accent transition-colors"
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

export default TemplateEditor
