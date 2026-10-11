/**
 * TableImportModal Component
 *
 * Modal for importing tables from raw text (copied from PDFs).
 * Two-step workflow: Input → Preview & Edit → Import
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Modal } from '@/components/common/Modal'
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
import { analyzeConversion, markConversionReviewed, getSourcePageError } from '@/lib/conversionVerification'
import type { SimpleTable, Entry } from '@/engine/types'

interface TableImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (table: SimpleTable) => void
  /** IDs occupied by tables or templates in the receiving document. */
  existingTableIds?: string[]
}

type ImportStep = 'input' | 'preview'

export function TableImportModal({ isOpen, onClose, onImport, existingTableIds = [] }: TableImportModalProps) {
  const [step, setStep] = useState<ImportStep>('input')
  const [rawText, setRawText] = useState('')
  const [parseResult, setParseResult] = useState<ParsedTableResult | null>(null)
  const [editedTable, setEditedTable] = useState<SimpleTable | null>(null)
  const [sourceReviewed, setSourceReviewed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('input')
      setRawText('')
      setParseResult(null)
      setEditedTable(null)
      setSourceReviewed(false)
    }
  }, [isOpen])

  // Focus textarea on mount and step change
  useEffect(() => {
    if (isOpen && step === 'input') {
      const timer = setTimeout(() => textareaRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, step])

  const handleParse = useCallback(() => {
    const result = parseTableText(rawText)
    setParseResult(result)
    setSourceReviewed(false)
    if (result.success && result.table) {
      let id = result.table.id
      let suffix = 1
      while (existingTableIds.includes(id)) id = `${result.table.id}${suffix++}`
      setEditedTable({ ...result.table, id })
    } else {
      setEditedTable(null)
    }
    setStep('preview')
  }, [rawText, existingTableIds])

  const handleImport = useCallback(() => {
    if (editedTable) {
      if (analyzeConversion(editedTable).errors.length || existingTableIds.includes(editedTable.id)) return
      onImport(sourceReviewed ? markConversionReviewed(editedTable) : editedTable)
      onClose()
    }
  }, [editedTable, sourceReviewed, existingTableIds, onImport, onClose])

  const handleBack = useCallback(() => {
    setStep('input')
    setSourceReviewed(false)
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
      } else if (field === 'weight') {
        entry.weight = value as number
      } else if (field === 'range') {
        entry.range = value as [number, number]
      }

      newEntries[index] = entry
      setSourceReviewed(false)
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
      delete entry.weight

      if (which === 'start') {
        entry.range = [value, currentRange[1]]
      } else {
        entry.range = [currentRange[0], value]
      }

      newEntries[index] = entry
      setSourceReviewed(false)
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

    setSourceReviewed(false)
    setEditedTable({
      ...editedTable,
      entries: [...editedTable.entries, newEntry],
    })
  }, [editedTable])

  const removeEntry = useCallback(
    (index: number) => {
      if (!editedTable || editedTable.entries.length <= 1) return

      const newEntries = editedTable.entries.filter((_, i) => i !== index)
      setSourceReviewed(false)
      setEditedTable({ ...editedTable, entries: newEntries })
    },
    [editedTable]
  )

  const collisionError = editedTable && existingTableIds.includes(editedTable.id) ? 'This ID already belongs to a table or template. Choose a unique ID before importing.' : undefined
  const importErrors = [...(editedTable ? analyzeConversion(editedTable).errors : []), ...(collisionError ? [collisionError] : [])]
  const updateTable = (table: SimpleTable) => { setSourceReviewed(false); setEditedTable(table) }

  if (!isOpen) return null

  return (
    <Modal onClose={onClose} aria-labelledby="table-import-title" className={cn(
      'bg-background border border-border rounded-lg shadow-xl',
      'w-full max-w-5xl max-h-[85vh] flex flex-col animate-fade-in'
    )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-primary" />
            <h2 id="table-import-title" className="text-lg font-semibold">Import Table</h2>
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
              collisionError={collisionError}
              editedTable={editedTable}
              onUpdateTable={updateTable}
              sourceReviewed={sourceReviewed}
              onSourceReviewed={setSourceReviewed}
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
                disabled={!editedTable || importErrors.length > 0}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Check className="w-4 h-4" />
                {sourceReviewed ? 'Import Reviewed Table' : 'Import Unreviewed Table'}
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
    </Modal>
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
        detect the table format automatically. Put the heading on its own line and
        each numbered outcome on a separate line. If a PDF copy merges columns,
        insert line breaks before parsing so numbers in the text remain intact.
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
          <li>NdM with optional fixed +N or -N modifier: heading, then one numbered outcome per line</li>
          <li>d6/d20 tables: heading, then one numbered outcome per line</li>
          <li>d100 with ranges: one range per line, such as "1-30 Common item"</li>
          <li>Outcomes copied out of order (will reorder by outcome number)</li>
          <li>No numbers: one entry per line, using equal weights</li>
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
  collisionError?: string
  sourceReviewed: boolean
  onSourceReviewed: (reviewed: boolean) => void
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
  sourceReviewed,
  collisionError,
  onSourceReviewed,
  onUpdateEntry,
  onUpdateEntryRange,
  onAddEntry,
  onRemoveEntry,
}: PreviewStepProps) {
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (result && !result.success) errorRef.current?.focus() }, [result])
  if (!result) {
    return <div className="text-sm text-muted-foreground">No results to display.</div>
  }

  if (!result.success) {
    return (
      <div className="space-y-4">
        <div ref={errorRef} tabIndex={-1} role="alert" aria-labelledby="import-errors" className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 id="import-errors" className="font-medium text-destructive">Parse Errors</h3>
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

  const analysis = analyzeConversion(editedTable)
  const sourcePageError = getSourcePageError(editedTable.source?.page)
  const warnings = [...new Set([...result.warnings, ...analysis.issues, ...(collisionError ? [collisionError] : [])])]
  const updateProvenance = (field: 'kind' | 'notes', value: string) => onUpdateTable({ ...editedTable, conversion: { ...editedTable.conversion!, [field]: value } })

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {warnings.length > 0 && (
        <div role={analysis.errors.length || collisionError ? "alert" : "status"} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-medium text-amber-500">Warnings</h4>
          </div>
          <ul className="text-xs space-y-0.5 text-amber-500/80">
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-muted-foreground">This preview checks structure and selection mechanics. Source fidelity requires your review. Imports use specification 1.1.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="import-book" className="text-sm font-medium">Source book (optional)</label>
          <input id="import-book" value={editedTable.source?.book ?? ''} onChange={e => onUpdateTable({ ...editedTable, source: { ...editedTable.source, book: e.target.value.trim() ? e.target.value : undefined } })} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:ring-2 focus:ring-primary" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="import-page" className="text-sm font-medium">Source page (optional)</label>
          <input id="import-page" aria-invalid={!!sourcePageError} aria-describedby={sourcePageError ? "import-page-error" : "import-page-hint"} value={editedTable.source?.page ?? ''} onChange={e => onUpdateTable({ ...editedTable, source: { ...editedTable.source, page: e.target.value.trim() || undefined } })} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:ring-2 focus:ring-primary" />
          <p id="import-page-hint" className="text-sm text-muted-foreground">Use a page number or range, such as 12-14.</p>
          {sourcePageError && <p id="import-page-error" className="text-sm text-destructive">{sourcePageError}</p>}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="import-kind" className="text-sm font-medium">Interpretation</label>
          <select id="import-kind" value={editedTable.conversion?.kind ?? 'transcription'} onChange={e => updateProvenance('kind', e.target.value)} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:ring-2 focus:ring-primary">
            <option value="transcription">Faithful transcription</option>
            <option value="adaptation">Mechanical adaptation</option>
            <option value="original">Original material</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="import-notes" className="text-sm font-medium">Conversion notes (optional)</label>
          <textarea id="import-notes" value={editedTable.conversion?.notes ?? ''} onChange={e => updateProvenance('notes', e.target.value)} placeholder="Record adaptations, omitted instructions or uncertainties." className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:ring-2 focus:ring-primary" />
        </div>
      </div>
      {/* Table Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="table-id" className="text-sm font-medium">
            Table ID
          </label>
          <input
            id="table-id"
            aria-invalid={!!collisionError}
            aria-describedby={collisionError ? "import-id-error" : undefined}
            type="text"
            value={editedTable.id}
            onChange={(e) => onUpdateTable({ ...editedTable, id: e.target.value })}
            className={cn(
              'w-full px-3 py-1.5 rounded-md border border-border bg-background',
              'text-sm font-mono',
              'focus:outline-none focus:ring-2 focus:ring-primary/50'
            )}
          />
          {collisionError && <p id="import-id-error" className="text-sm text-destructive">{collisionError}</p>}
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

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="import-original" className="min-w-0 space-y-2">
          <h3 id="import-original" className="text-sm font-medium">Original source text</h3>
          <pre className="whitespace-pre-wrap break-words max-h-[50vh] overflow-auto p-3 rounded-md border border-border text-sm font-mono">{editedTable.conversion?.sourceText ?? result.sourceText}</pre>
        </section>
        <section aria-labelledby="import-parsed" className="min-w-0 space-y-2">
          <h3 id="import-parsed" className="text-sm font-medium">Parsed entries</h3>
          {editedTable.selection && <div className="space-y-1"><label htmlFor="import-dice" className="text-sm font-medium">Source selection dice</label><input id="import-dice" value={editedTable.selection.dice} onChange={e => onUpdateTable({ ...editedTable, selection: { mode: 'dice', dice: e.target.value } })} className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:ring-2 focus:ring-primary" /></div>}
          <p className="text-sm">{analysis.mechanic}{analysis.domain ? `; possible totals ${analysis.domain[0]}–${analysis.domain[1]}` : ''}.</p>
          <p className="text-sm text-muted-foreground">{analysis.errors.length ? 'Coverage or entry errors need correction before import.' : 'Structure checked. Compare every outcome and source instruction before marking reviewed.'}</p>
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
              {entry.range || editedTable.selection ? <div className="flex items-center gap-1 flex-shrink-0">
                <input
                  type="number"
                  aria-label={`Entry ${index + 1} range start`}
                  value={entry.range?.[0] ?? index + 1}
                  onChange={(e) =>
                    onUpdateEntryRange(index, 'start', Number(e.target.value))
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
                  aria-label={`Entry ${index + 1} range end`}
                  value={entry.range?.[1] ?? index + 1}
                  onChange={(e) =>
                    onUpdateEntryRange(index, 'end', Number(e.target.value))
                  }
                  className={cn(
                    'w-12 px-1.5 py-1 rounded border border-border bg-background',
                    'text-xs text-center',
                    'focus:outline-none focus:ring-1 focus:ring-primary/50'
                  )}
                />
              </div> : <div className="space-y-1"><label htmlFor={`import-weight-${index}`} className="text-xs">Weight</label><input id={`import-weight-${index}`} type="number" min="0" value={entry.weight ?? 1} onChange={e => onUpdateEntry(index, 'weight', Number(e.target.value))} className="w-16 px-1.5 py-1 rounded border border-border bg-background text-xs focus:ring-1 focus:ring-primary" /></div>}

              {/* Value input */}
              <input
                type="text"
                aria-label={`Entry ${index + 1} output text`}
                value={entry.value}
                onChange={(e) => onUpdateEntry(index, 'value', e.target.value)}
                className={cn(
                  'flex-1 px-2 py-1 rounded border border-border bg-background',
                  'text-sm',
                  'focus:outline-none focus:ring-1 focus:ring-primary/50'
                )}
              />

              <span className="text-xs text-muted-foreground pt-1" aria-label={`Entry ${index + 1} probability`}>{analysis.probabilities ? (analysis.probabilities[index] > 0 && analysis.probabilities[index] < 0.0001 ? '<0.01%' : `${(analysis.probabilities[index] * 100).toFixed(2)}%`) : 'Unknown'}</span>
              {/* Delete button */}
              <button
                onClick={() => onRemoveEntry(index)}
                disabled={editedTable.entries.length <= 1}
                className={cn(
                  'p-1 rounded hover:bg-accent transition-colors flex-shrink-0',
                  'text-muted-foreground hover:text-destructive',
                  'disabled:opacity-30 disabled:cursor-not-allowed'
                )}
                aria-label={`Remove entry ${index + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
        </section>
      </div>
      <label className="flex items-start gap-2 text-sm py-2">
        <input type="checkbox" checked={sourceReviewed} disabled={analysis.errors.length > 0 || !!collisionError} onChange={e => onSourceReviewed(e.target.checked)} className="mt-1 focus:ring-2 focus:ring-primary" />
        <span>I compared every entry, probability and instruction with the source and accept this interpretation. Mark this content as reviewed by me.</span>
      </label>
      <p className="text-sm text-muted-foreground">{sourceReviewed ? 'Reviewed applies to this exact content. Later changes require a new review.' : 'Import will retain the original text and be labeled Unreviewed. You can review it later.'}</p>
    </div>
  )
}

export default TableImportModal
