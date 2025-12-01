/**
 * TableImportModal Component
 *
 * Modal for importing tables from raw text (copied from PDFs).
 * Two-step workflow: Input → Preview & Edit → Import
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  FileUp,
  AlertTriangle,
  Plus,
  Trash2,
  ArrowLeft,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseTableText, type ParsedTableResult } from '@/lib/tableParser'
import type { SimpleTable, Entry } from '@/engine/types'

interface TableImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (table: SimpleTable) => void
}

type ImportStep = 'input' | 'preview'

export function TableImportModal({ isOpen, onClose, onImport }: TableImportModalProps) {
  const [step, setStep] = useState<ImportStep>('input')
  const [rawText, setRawText] = useState('')
  const [parseResult, setParseResult] = useState<ParsedTableResult | null>(null)
  const [editedTable, setEditedTable] = useState<SimpleTable | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('input')
      setRawText('')
      setParseResult(null)
      setEditedTable(null)
    }
  }, [isOpen])

  // Focus textarea on mount and step change
  useEffect(() => {
    if (isOpen && step === 'input') {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen, step])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleParse = useCallback(() => {
    const result = parseTableText(rawText)
    setParseResult(result)
    if (result.success && result.table) {
      setEditedTable({ ...result.table })
    } else {
      setEditedTable(null)
    }
    setStep('preview')
  }, [rawText])

  const handleImport = useCallback(() => {
    if (editedTable) {
      onImport(editedTable)
      onClose()
    }
  }, [editedTable, onImport, onClose])

  const handleBack = useCallback(() => {
    setStep('input')
    setParseResult(null)
    setEditedTable(null)
  }, [])

  // Entry editing handlers
  const updateEntry = useCallback(
    (index: number, field: keyof Entry, value: string | number | [number, number]) => {
      if (!editedTable) return

      const newEntries = [...editedTable.entries]
      const entry = { ...newEntries[index] }

      if (field === 'value') {
        entry.value = value as string
      } else if (field === 'range') {
        entry.range = value as [number, number]
      }

      newEntries[index] = entry
      setEditedTable({ ...editedTable, entries: newEntries })
    },
    [editedTable]
  )

  const updateEntryRange = useCallback(
    (index: number, which: 'start' | 'end', value: number) => {
      if (!editedTable) return

      const newEntries = [...editedTable.entries]
      const entry = { ...newEntries[index] }
      const currentRange = entry.range || [1, 1]

      if (which === 'start') {
        entry.range = [value, currentRange[1]]
      } else {
        entry.range = [currentRange[0], value]
      }

      newEntries[index] = entry
      setEditedTable({ ...editedTable, entries: newEntries })
    },
    [editedTable]
  )

  const addEntry = useCallback(() => {
    if (!editedTable) return

    const lastEntry = editedTable.entries[editedTable.entries.length - 1]
    const lastRange = lastEntry?.range || [0, 0]
    const newStart = lastRange[1] + 1

    const newEntry: Entry = {
      value: 'New entry',
      range: [newStart, newStart],
    }

    setEditedTable({
      ...editedTable,
      entries: [...editedTable.entries, newEntry],
    })
  }, [editedTable])

  const removeEntry = useCallback(
    (index: number) => {
      if (!editedTable || editedTable.entries.length <= 1) return

      const newEntries = editedTable.entries.filter((_, i) => i !== index)
      setEditedTable({ ...editedTable, entries: newEntries })
    },
    [editedTable]
  )

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-background border border-border rounded-lg shadow-xl',
          'w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col',
          'animate-fade-in'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Import Table</h2>
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-medium">
              BETA
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-auto">
          {step === 'input' && (
            <InputStep
              rawText={rawText}
              onChange={setRawText}
              textareaRef={textareaRef}
            />
          )}

          {step === 'preview' && (
            <PreviewStep
              result={parseResult}
              editedTable={editedTable}
              onUpdateTable={setEditedTable}
              onUpdateEntry={updateEntry}
              onUpdateEntryRange={updateEntryRange}
              onAddEntry={addEntry}
              onRemoveEntry={removeEntry}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex justify-between">
          {step === 'preview' ? (
            <>
              <button
                onClick={handleBack}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm',
                  'hover:bg-accent transition-colors'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={!editedTable}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Check className="w-4 h-4" />
                Import Table
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm',
                  'hover:bg-accent transition-colors'
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!rawText.trim()}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Parse Text
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ============================================================================
// Input Step
// ============================================================================

interface InputStepProps {
  rawText: string
  onChange: (text: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
}

function InputStep({ rawText, onChange, textareaRef }: InputStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Paste text copied from a PDF or other source. The importer will attempt to
        detect the table format automatically.
      </p>

      <div className="space-y-2">
        <label htmlFor="raw-text" className="text-sm font-medium">
          Raw Table Text
        </label>
        <textarea
          ref={textareaRef}
          id="raw-text"
          value={rawText}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`d6 Random Encounters\n1 Wandering merchant\n2 Pack of wolves\n3 Mysterious stranger\n4 Abandoned campsite\n5 Hidden treasure\n6 Ancient ruins`}
          className={cn(
            'w-full h-64 p-3 rounded-md border border-border bg-background',
            'text-sm font-mono resize-y',
            'placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-2 focus:ring-primary/50'
          )}
        />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          Supported formats
        </summary>
        <ul className="mt-2 space-y-1 text-muted-foreground pl-4 list-disc">
          <li>d6/d20 tables: "d6 Table Name 1 Entry 2 Entry..."</li>
          <li>d100 with ranges: "d100 Name 1-30 Entry 31-60 Entry..."</li>
          <li>Multi-column PDF copies (will attempt to reorder)</li>
          <li>No numbers: Entries separated by periods</li>
          <li>Note: "00" is interpreted as 100</li>
        </ul>
      </details>
    </div>
  )
}

// ============================================================================
// Preview Step
// ============================================================================

interface PreviewStepProps {
  result: ParsedTableResult | null
  editedTable: SimpleTable | null
  onUpdateTable: (table: SimpleTable) => void
  onUpdateEntry: (
    index: number,
    field: keyof Entry,
    value: string | number | [number, number]
  ) => void
  onUpdateEntryRange: (index: number, which: 'start' | 'end', value: number) => void
  onAddEntry: () => void
  onRemoveEntry: (index: number) => void
}

function PreviewStep({
  result,
  editedTable,
  onUpdateTable,
  onUpdateEntry,
  onUpdateEntryRange,
  onAddEntry,
  onRemoveEntry,
}: PreviewStepProps) {
  if (!result) {
    return <div className="text-sm text-muted-foreground">No results to display.</div>
  }

  if (!result.success) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="font-medium text-destructive">Parse Errors</h3>
          </div>
          <ul className="text-sm space-y-1 text-destructive/80">
            {result.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          Go back and edit the text, then try parsing again.
        </p>
      </div>
    )
  }

  if (!editedTable) {
    return <div className="text-sm text-muted-foreground">No table to display.</div>
  }

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-medium text-amber-500">Warnings</h4>
          </div>
          <ul className="text-xs space-y-0.5 text-amber-500/80">
            {result.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Table Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="table-id" className="text-sm font-medium">
            Table ID
          </label>
          <input
            id="table-id"
            type="text"
            value={editedTable.id}
            onChange={(e) => onUpdateTable({ ...editedTable, id: e.target.value })}
            className={cn(
              'w-full px-3 py-1.5 rounded-md border border-border bg-background',
              'text-sm font-mono',
              'focus:outline-none focus:ring-2 focus:ring-primary/50'
            )}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="table-name" className="text-sm font-medium">
            Table Name
          </label>
          <input
            id="table-name"
            type="text"
            value={editedTable.name}
            onChange={(e) => onUpdateTable({ ...editedTable, name: e.target.value })}
            className={cn(
              'w-full px-3 py-1.5 rounded-md border border-border bg-background',
              'text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/50'
            )}
          />
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Entries ({editedTable.entries.length})
          </span>
          <button
            onClick={onAddEntry}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs',
              'hover:bg-accent transition-colors text-muted-foreground'
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Entry
          </button>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-auto pr-1">
          {editedTable.entries.map((entry, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-2 p-2 rounded-md bg-muted/50 border border-border/50'
              )}
            >
              {/* Range inputs */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <input
                  type="number"
                  value={entry.range?.[0] ?? index + 1}
                  onChange={(e) =>
                    onUpdateEntryRange(index, 'start', parseInt(e.target.value) || 1)
                  }
                  className={cn(
                    'w-12 px-1.5 py-1 rounded border border-border bg-background',
                    'text-xs text-center',
                    'focus:outline-none focus:ring-1 focus:ring-primary/50'
                  )}
                />
                <span className="text-xs text-muted-foreground">-</span>
                <input
                  type="number"
                  value={entry.range?.[1] ?? index + 1}
                  onChange={(e) =>
                    onUpdateEntryRange(index, 'end', parseInt(e.target.value) || 1)
                  }
                  className={cn(
                    'w-12 px-1.5 py-1 rounded border border-border bg-background',
                    'text-xs text-center',
                    'focus:outline-none focus:ring-1 focus:ring-primary/50'
                  )}
                />
              </div>

              {/* Value input */}
              <input
                type="text"
                value={entry.value}
                onChange={(e) => onUpdateEntry(index, 'value', e.target.value)}
                className={cn(
                  'flex-1 px-2 py-1 rounded border border-border bg-background',
                  'text-sm',
                  'focus:outline-none focus:ring-1 focus:ring-primary/50'
                )}
              />

              {/* Delete button */}
              <button
                onClick={() => onRemoveEntry(index)}
                disabled={editedTable.entries.length <= 1}
                className={cn(
                  'p-1 rounded hover:bg-accent transition-colors flex-shrink-0',
                  'text-muted-foreground hover:text-destructive',
                  'disabled:opacity-30 disabled:cursor-not-allowed'
                )}
                aria-label="Remove entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TableImportModal
