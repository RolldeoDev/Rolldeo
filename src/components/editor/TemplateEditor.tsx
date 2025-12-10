/**
 * TemplateEditor Component
 *
 * Visual editor for template patterns with syntax helper buttons.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
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
  CircleDot,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KeyValueEditor } from './KeyValueEditor'
import { InsertDropdown } from './InsertDropdown'
import { PatternPreview, type EditablePatternRef } from './PatternPreview'
import { ResultTypeSelector } from './ResultTypeSelector'
import type { Template, SharedVariables, Table } from '@/engine/types'
import type { TableInfo, TemplateInfo, ImportedTableInfo, ImportedTemplateInfo } from '@/engine/core'
import type { Suggestion } from '@/hooks/usePatternSuggestions'

export interface TemplateEditorProps {
  /** The template to edit */
  template: Template
  /** Called when template changes */
  onChange: (template: Template) => void
  /** Called when template should be deleted */
  onDelete: () => void
  /** Available local tables for references */
  localTables: TableInfo[]
  /** Available local templates for references */
  localTemplates?: TemplateInfo[]
  /** Tables from imported collections */
  importedTables?: ImportedTableInfo[]
  /** Templates from imported collections */
  importedTemplates?: ImportedTemplateInfo[]
  /** Suggestions for autocomplete */
  suggestions?: Suggestion[]
  /** Full table data for property lookups (keyed by table ID) */
  tableMap?: Map<string, Table>
  /** Full template data for property lookups (keyed by template ID) */
  templateMap?: Map<string, Template>
  /** Document-level shared variables for autocomplete */
  documentShared?: Record<string, string>
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
  localTables,
  localTemplates = [],
  importedTables = [],
  importedTemplates = [],
  suggestions,
  tableMap,
  templateMap,
  documentShared,
  defaultExpanded = false,
  collectionId,
  onFocus,
  onBlur,
  onExpandChange,
}: TemplateEditorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const patternEditorRef = useRef<EditablePatternRef>(null)
  const prevDefaultExpandedRef = useRef(defaultExpanded)

  // Real-time ID uniqueness validation
  const idError = useMemo(() => {
    const currentId = template.id.trim()
    if (!currentId) return null

    // Check for duplicate template IDs (excluding this template)
    const duplicateTemplate = localTemplates.find(t => t.id === currentId && t.id !== template.id)
    if (duplicateTemplate) {
      return `Template ID "${currentId}" already exists`
    }

    // Check for collision with table IDs
    const collidingTable = localTables.find(t => t.id === currentId)
    if (collidingTable) {
      return `ID "${currentId}" is already used by a table`
    }

    return null
  }, [template.id, localTables, localTemplates])

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

  // Memoize filtered templates to avoid creating new array references on every render
  // This is critical for preventing unnecessary re-renders of KeyValueEditor's ExpressionPreview
  const filteredLocalTemplates = useMemo(
    () => localTemplates.filter(t => t.id !== template.id),
    [localTemplates, template.id]
  )

  const filteredImportedTemplates = useMemo(
    () => importedTemplates.filter(t => t.id !== template.id),
    [importedTemplates, template.id]
  )

  // Memoize combined shared variables for KeyValueEditor
  const combinedSharedVariables = useMemo(
    () => ({ ...documentShared, ...(template.shared as Record<string, string> | undefined) }),
    [documentShared, template.shared]
  )

  // Augment suggestions with template-level shared variables
  const augmentedSuggestions = useMemo(() => {
    if (!suggestions) return []

    const templateShared = template.shared as Record<string, string> | undefined
    if (!templateShared || Object.keys(templateShared).length === 0) {
      return suggestions
    }

    // Create suggestions for template's shared variables
    const templateSharedSuggestions: Suggestion[] = Object.keys(templateShared).map(varName => {
      // Handle both cases: varName might be "heroName" or "$heroName"
      const displayName = varName.startsWith('$') ? varName : `$${varName}`
      return {
        id: `template-shared-${varName}`,
        label: displayName,
        insertText: displayName,
        category: 'variable' as const,
        description: `Template shared: ${templateShared[varName]}`,
        icon: CircleDot,
        source: 'Template',
        colorClass: 'pink' as const,
      }
    })

    // Filter out any document-level variables with the same name (template takes precedence)
    const templateVarNames = new Set(Object.keys(templateShared).map(v => v.startsWith('$') ? v : `$${v}`))
    const filteredSuggestions = suggestions.filter(
      s => !(s.category === 'variable' && templateVarNames.has(s.label))
    )

    return [...filteredSuggestions, ...templateSharedSuggestions]
  }, [suggestions, template.shared])

  return (
    <div className={cn("editor-card", isExpanded && "editor-card-expanded-lavender")} onFocus={handleFocus} onBlur={handleBlur}>
      {/* Template Header */}
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
        <div className="p-4 space-y-5 mobile-form-container">
          {/* Basic Info */}
          <div className="editor-field-group">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <div>
                <label className="editor-label editor-label-required">Template ID</label>
                <input
                  type="text"
                  value={template.id}
                  onChange={(e) => updateField('id', e.target.value)}
                  placeholder="uniqueTemplateId"
                  className={cn(
                    "editor-input text-base md:text-sm min-h-[48px] md:min-h-0",
                    idError && "border-destructive focus:ring-destructive"
                  )}
                />
                {idError && (
                  <p className="text-xs text-destructive mt-1">{idError}</p>
                )}
              </div>

              <div>
                <label className="editor-label editor-label-required">Name</label>
                <input
                  type="text"
                  value={template.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Template Name"
                  className="editor-input text-base md:text-sm min-h-[48px] md:min-h-0"
                />
              </div>

              <div>
                <label className="editor-label">Result Type</label>
                <ResultTypeSelector
                  value={template.resultType}
                  onChange={(value) => updateField('resultType', value)}
                  placeholder="Select or enter type..."
                />
              </div>
            </div>

            {/* Description */}
            <div className="mt-4">
              <label className="editor-label">Description</label>
              <input
                type="text"
                value={template.description || ''}
                onChange={(e) =>
                  updateField('description', e.target.value || undefined)
                }
                placeholder="Template description"
                className="editor-input text-base md:text-sm min-h-[48px] md:min-h-0"
              />
            </div>
          </div>

          {/* Shared Variables (collapsible) */}
          <details className="editor-collapsible">
            <summary>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Shared Variables</span>
                <span className="text-xs text-muted-foreground">(optional)</span>
                {template.shared && Object.keys(template.shared).length > 0 && (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-rose/15 text-rose">
                    {Object.keys(template.shared).length}
                  </span>
                )}
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
            <div className="editor-collapsible-content space-y-3">
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
                keyPattern="^\$?[a-zA-Z_][a-zA-Z0-9_]*$"
                keyError="Must start with letter/underscore, alphanumeric only"
                valueSupportsExpressions
                collectionId={collectionId}
                showInsertButton
                localTables={localTables}
                localTemplates={filteredLocalTemplates}
                importedTables={importedTables}
                importedTemplates={filteredImportedTemplates}
                suggestions={suggestions}
                tableMap={tableMap}
                templateMap={templateMap}
                sharedVariables={combinedSharedVariables}
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
                localTables={localTables}
                localTemplates={filteredLocalTemplates}
                importedTables={importedTables}
                importedTemplates={filteredImportedTemplates}
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
                    localTables.length > 0 ? localTables[0].id : 'tableId'
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
                    localTables.length > 0 ? localTables[0].id : 'tableId'
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
              availableTableIds={localTables.map(t => t.id)}
              availableTemplateIds={filteredLocalTemplates.map(t => t.id)}
              sharedVariables={template.shared as Record<string, string> | undefined}
              suggestions={augmentedSuggestions}
              tableMap={tableMap}
              templateMap={templateMap}
              autocompleteSharedVariables={combinedSharedVariables}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="editor-label">Tags</label>
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
      className="editor-input-btn flex items-center gap-1.5 px-3 md:px-2.5 py-2 md:py-1 text-sm md:text-xs rounded-xl md:rounded-lg flex-shrink-0 min-h-[40px] md:min-h-0"
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
    <div className="editor-input p-3 md:p-2">
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
