import type { SimpleTable, Table, AuthoredTable } from '@/engine/types'
import { getDiceEntryProbabilities, parseSelectionDice, validateDiceSelection } from '@/engine/tables/diceSelection'
import { getWeight, getNormalizedProbabilities, isValidWeightedRange } from '@/engine/tables/weights'

export type ConversionReviewStatus = 'none' | 'unreviewed' | 'reviewed' | 'stale'

/** Canonical table snapshot. Shared declaration order is semantic and stays intact. */
export function canonicalConversionContent(table: Table | AuthoredTable): string {
  function canonical(value: unknown, preserveOrder = false): unknown {
    if (Array.isArray(value)) return value.map(item => canonical(item))
    if (!value || typeof value !== 'object') return value
    const result = Object.create(null) as Record<string, unknown>
    for (const key of preserveOrder ? Object.keys(value) : Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key]
      if (item !== undefined) result[key] = canonical(item, ['shared', 'sets', 'defaultSets'].includes(key))
    }
    return result
  }
  const conversion = table.conversion ? { ...table.conversion } : undefined
  if (conversion) {
    delete conversion.reviewedContent
    delete conversion.reviewedAt
  }
  return JSON.stringify(canonical({ ...table, conversion }))
}

export function getConversionReviewStatus(table: Table | AuthoredTable): ConversionReviewStatus {
  const provenance = table.conversion
  if (!provenance) return 'none'
  if (!provenance.reviewedContent || !provenance.reviewedAt || !Number.isFinite(Date.parse(provenance.reviewedAt))) return 'unreviewed'
  return provenance.reviewedContent === canonicalConversionContent(table) ? 'reviewed' : 'stale'
}

/** Records a human review of this exact content; never an engine fidelity claim. */
export function markConversionReviewed<T extends Table | AuthoredTable>(table: T, now = new Date(), resolvedTable?: SimpleTable): T {
  if (!table.conversion) throw new Error('A conversion needs provenance before source review can be recorded.')
  if (table.type === 'simple') {
    if (table.extends && (!resolvedTable || resolvedTable.id !== table.id)) throw new Error('An inherited table requires its current resolved content before source review.')
    const content = table.extends ? resolvedTable! : table as SimpleTable
    if (analyzeConversion(content).errors.length) throw new Error('Resolve table errors before recording source review.')
  }
  return { ...table, conversion: { ...table.conversion, reviewedContent: canonicalConversionContent(table), reviewedAt: now.toISOString() } }
}

export interface ConversionAnalysis {
  mechanic: string
  domain?: [number, number]
  /** Issues that prevent import as an executable table, including coverage errors. */
  errors: string[]
  issues: string[]
  /** Actual probabilities, never range widths substituted for native dice probabilities. */
  probabilities: number[] | null
}

/** Matches both page alternatives in the tableSource schema. */
export function getSourcePageError(page: unknown): string | undefined {
  if (page === undefined) return undefined
  if (typeof page === 'string' && /^\d+(-\d+)?$/.test(page)) return undefined
  if (typeof page === 'number' && Number.isInteger(page) && page >= 1) return undefined
  return 'Source page must be a page number or range, such as 12 or 12-14. Leave it blank if unknown.'
}

export function analyzeConversion(table: SimpleTable): ConversionAnalysis {
  const errors: string[] = []
  const sourcePageError = getSourcePageError(table.source?.page)
  if (sourcePageError) errors.push(sourcePageError)
  if (!table.id || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table.id)) errors.push('Table ID must start with a letter or underscore and contain only letters, numbers or underscores.')
  if (['dice', 'unique', 'again', 'true', 'false', 'null', 'and', 'or', 'not', 'contains', 'matches', 'shared', 'math'].includes(table.id.toLowerCase())) errors.push('Table ID is a reserved word; choose another ID.')
  if (!table.name.trim()) errors.push('Table name is required.')
  if (!table.entries.length) errors.push('At least one entry is required.')
  table.entries.forEach((entry, index) => {
    if (!entry.value.trim()) errors.push(`Entry ${index + 1} needs output text.`)
    if (entry.range && (table.selection
      ? !Array.isArray(entry.range) || entry.range.length !== 2 || !entry.range.every(Number.isSafeInteger) || entry.range[0] > entry.range[1] || !Number.isSafeInteger(entry.range[1] - entry.range[0] + 1)
      : !isValidWeightedRange(entry.range))) errors.push(`Entry ${index + 1} has an invalid range.`)
    if (entry.range && entry.weight !== undefined) errors.push(`Entry ${index + 1} cannot use both a range and a weight.`)
    if (entry.weight !== undefined && (!Number.isFinite(entry.weight) || entry.weight < 0)) errors.push(`Entry ${index + 1} needs a finite, nonnegative weight.`)
  })
  if (table.selection) {
    const selectionIssues = validateDiceSelection(table)
    errors.push(...selectionIssues.filter(issue => issue.type === 'error').map(issue => issue.message))
    let domain: [number, number] | undefined
    try {
      const dice = parseSelectionDice(table.selection.dice)
      domain = [dice.min, dice.max]
    } catch { /* Reported by validateDiceSelection. */ }
    const probabilities = errors.length ? null : getDiceEntryProbabilities(table)
    return { mechanic: `Roll ${table.selection.dice}, then look up the total`, domain, errors,
      issues: [...errors, ...selectionIssues.filter(issue => issue.type === 'warning').map(issue => issue.message),
        ...(!errors.length && !probabilities ? ['Exact probability preview is unavailable for this large dice domain. Mechanics still use the stated dice.'] : [])], probabilities }
  }
  const weights = table.entries.map(entry => ({ weight: getWeight(entry) }))
  if (!weights.some(entry => entry.weight > 0)) errors.push('The table needs at least one positive selection weight.')
  return { mechanic: 'Weighted selection (ranges are widths, not source dice)', errors, issues: errors,
    probabilities: errors.length ? null : getNormalizedProbabilities(weights) }
}
