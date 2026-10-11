import { useEffect, useId, useState } from 'react'
import type { AuthoredTable, ConversionProvenance, Table } from '@/engine/types'
import { analyzeConversion, getConversionReviewStatus, markConversionReviewed } from '@/lib/conversionVerification'

/** Source review is an explicit human judgement of this authored table. */
export function ConversionReviewPanel({ table, resolvedTable, onChange }: {
  table: AuthoredTable
  resolvedTable?: Table
  onChange: (table: AuthoredTable) => void
}) {
  const fieldId = useId()
  const [acknowledged, setAcknowledged] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  useEffect(() => { setAcknowledged(false); setReviewError(null) }, [table])
  const status = getConversionReviewStatus(table)
  const checkTable = table.extends ? resolvedTable : table
  const errors = !checkTable
    ? ['Resolve this table’s inheritance before recording a source review.']
    : checkTable.type === 'simple' ? analyzeConversion(checkTable as import('@/engine/types').SimpleTable).errors : []
  const currentEntries = checkTable?.type === 'simple' ? checkTable.entries : []
  const updateConversion = <K extends keyof ConversionProvenance>(field: K, value: ConversionProvenance[K]) => {
    onChange({ ...table, conversion: { ...(table.conversion || { kind: 'transcription' }), [field]: value } })
  }
  return (
    <details className="editor-collapsible">
      <summary className="font-medium text-sm">
        Review against source
        <span className="text-xs text-muted-foreground ml-2">{status === 'reviewed' ? 'Source reviewed' : status === 'stale' ? 'Changed since review' : status === 'unreviewed' ? 'Needs review' : 'Optional'}</span>
      </summary>
      <div className="editor-collapsible-content space-y-4">
        <p className="text-sm text-muted-foreground">Compare the source text or your book with the current entries. A review records your judgement of this exact table; it does not prove fidelity automatically. Referenced and inherited tables need their own review, and their changes are not tracked by this table’s status.</p>
        {!table.conversion ? (
          <button type="button" className="editor-input-btn px-3 py-2"
            onClick={() => onChange({ ...table, conversion: { kind: 'transcription' } })}>Add conversion record</button>
        ) : (
          <>
            <div>
              <label htmlFor={`${fieldId}-kind`} className="editor-label">Conversion kind</label>
              <select id={`${fieldId}-kind`} className="editor-select" value={table.conversion.kind}
                onChange={event => updateConversion('kind', event.target.value as ConversionProvenance['kind'])}>
                <option value="transcription">Faithful transcription</option>
                <option value="adaptation">Mechanical adaptation</option>
                <option value="original">New material</option>
              </select>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label htmlFor={`${fieldId}-source`} className="editor-label">Source text and instructions</label>
                <textarea id={`${fieldId}-source`} rows={8} className="editor-input resize-y" value={table.conversion.sourceText || ''}
                  onChange={event => updateConversion('sourceText', event.target.value || undefined)}
                  placeholder="Keep the table excerpt, dice header and any governing instructions here." />
              </div>
              <div>
                <p className="editor-label">Current results</p>
                {checkTable?.type === 'simple' ? <ol className="list-decimal pl-5 space-y-2 text-sm max-h-64 overflow-auto">
                  {currentEntries.map((entry, index) => <li key={index}>
                    <span className="font-medium">{entry.range ? `${entry.range[0]}–${entry.range[1]}` : `Weight ${entry.weight ?? 1}`}: </span>{entry.value ?? '(inherited value)'}
                  </li>)}
                </ol> : <p className="text-sm text-muted-foreground">Check this table’s selected or merged source tables in the editor above.</p>}
                {table.extends && <p className="text-sm text-muted-foreground mt-3">Authored overrides: {table.type === 'simple' ? table.entries.map(entry => entry.id || '(new entry)').join(', ') : 'None'}. The results above include inherited content.</p>}
                <p className="text-sm text-muted-foreground mt-3">{checkTable?.type === 'simple' && checkTable.selection ? `Selection: roll ${checkTable.selection.dice} and look up its total.` : 'Selection: weighted entries or source tables.'}</p>
              </div>
            </div>
            <div>
              <label htmlFor={`${fieldId}-notes`} className="editor-label">Adaptations and review notes</label>
              <textarea id={`${fieldId}-notes`} rows={3} className="editor-input resize-y" value={table.conversion.notes || ''}
                onChange={event => updateConversion('notes', event.target.value || undefined)}
                placeholder="Explain changed mechanics, omitted instructions or deliberate adaptations." />
            </div>
            {errors.length > 0 && <div role="alert" className="text-sm text-destructive space-y-1">
              <p>Resolve these errors before recording a source review:</p>
              {errors.map((error, index) => <p key={index}>{error}</p>)}
            </div>}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-primary" checked={acknowledged}
                onChange={event => setAcknowledged(event.target.checked)} />
              I checked the text, dice mechanics and instructions against the source.
            </label>
            <button type="button" className="editor-input-btn px-3 py-2 disabled:opacity-50" disabled={!acknowledged || errors.length > 0}
              onClick={() => {
                try {
                  onChange(markConversionReviewed(table, new Date(), resolvedTable?.type === 'simple' ? resolvedTable : undefined))
                } catch (error) {
                  setReviewError(error instanceof Error ? error.message : String(error))
                }
              }}>Record source review</button>
            {reviewError && <p role="alert" className="text-sm text-destructive">{reviewError}</p>}
          </>
        )}
      </div>
    </details>
  )
}
