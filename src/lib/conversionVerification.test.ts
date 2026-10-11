import { describe, expect, it } from 'vitest'
import { RandomTableEngine } from '@/engine/core'
import type { RandomTableDocument, SimpleTable } from '@/engine/types'
import { parseTableText } from './tableParser'
import { analyzeConversion, canonicalConversionContent, getConversionReviewStatus, markConversionReviewed } from './conversionVerification'

// Synthetic, deliberately original fixtures: they test mechanical fidelity,
// not the accuracy of extracting arbitrary commercial books or PDFs.
const reactionSource = '2d6 Reaction\n2 Hostile\n3-5 Wary\n6-8 Neutral\n9-11 Friendly\n12 Helpful'
function parsed(source = reactionSource) { return parseTableText(source).table! }
function engineFor(table: SimpleTable) {
  const document: RandomTableDocument = { metadata: { name: 'Synthetic conversion', namespace: 'test.conversion', version: '1.0.0', specVersion: '1.1' }, tables: [table] }
  const engine = new RandomTableEngine()
  engine.loadCollection(document, 'fixture')
  return engine
}

describe('synthetic source → importer → engine fidelity', () => {
  it('preserves every 2d6 pair and the resulting bell curve exactly', () => {
    const table = parsed()
    expect(table.selection).toEqual({ mode: 'dice', dice: '2d6' })
    const engine = engineFor(table)
    const counts: Record<string, number> = {}
    for (let first = 1; first <= 6; first++) for (let second = 1; second <= 6; second++) {
      const draws = [(first - 0.5) / 6, (second - 0.5) / 6]
      const text = engine.roll(table.id, 'fixture', { random: () => draws.shift()! }).text
      const total = first + second
      const expected = total === 2 ? 'Hostile' : total <= 5 ? 'Wary' : total <= 8 ? 'Neutral' : total <= 11 ? 'Friendly' : 'Helpful'
      expect(text).toBe(expected)
      counts[text] = (counts[text] ?? 0) + 1
    }
    expect(counts).toEqual({ Hostile: 1, Wary: 9, Neutral: 16, Friendly: 9, Helpful: 1 })
    expect(analyzeConversion(table).probabilities).toEqual(expect.arrayContaining([expect.closeTo(1 / 36), expect.closeTo(16 / 36)]))
  })

  it('preserves modified 3d6 selection and finite open-ended rules', () => {
    const table = parsed('3d6-3 Discovery\n1 or less Quiet\n2-13 Ordinary\n14 or more Amazing')
    expect(table.entries.map(entry => entry.range)).toEqual([[0, 1], [2, 13], [14, 15]])
    const engine = engineFor(table)
    expect(engine.roll(table.id, 'fixture', { random: () => 0 }).text).toBe('Quiet')
    expect(engine.roll(table.id, 'fixture', { random: () => 0.999 }).text).toBe('Amazing')
    expect(analyzeConversion(table).errors).toEqual([])
  })

  it('preserves percentile 00 source rows and all 100 equally likely outcomes', () => {
    const table = parsed('1d100 Finds\n01-99 Common\n00 Rare')
    const engine = engineFor(table)
    for (let face = 1; face <= 100; face++) expect(engine.roll(table.id, 'fixture', { random: () => (face - 0.5) / 100 }).text).toBe(face === 100 ? 'Rare' : 'Common')
    expect(analyzeConversion(table).probabilities).toEqual([expect.closeTo(0.99), expect.closeTo(0.01)])
  })
})

describe('conversion provenance and review integrity', () => {
  it('preserves raw source bytes through JSON export independently of normalization', () => {
    const raw = '  2d6 Reaction\r\n2–5 “Hostile”\r\n6–12 Fri\ufb01endly\t  '
    const table = parsed(raw)
    expect(table.conversion?.sourceText).toBe(raw)
    expect(JSON.parse(JSON.stringify(table)).conversion.sourceText).toBe(raw)
    expect(table.entries[0].value).toBe('"Hostile"')
    expect(getConversionReviewStatus(table)).toBe('unreviewed')
  })

  it('records human review and invalidates it on mechanics, prose, metadata, or source edits', () => {
    const table = markConversionReviewed(parsed(), new Date('2026-10-11T10:00:00Z'))
    expect(getConversionReviewStatus(table)).toBe('reviewed')
    const changes: SimpleTable[] = [
      { ...table, name: 'Changed' },
      { ...table, source: { book: 'Different source' } },
      { ...table, selection: { mode: 'dice', dice: '1d12' } },
      { ...table, entries: table.entries.map((entry, index) => index ? entry : { ...entry, value: 'Changed' }) },
      { ...table, conversion: { ...table.conversion!, sourceText: 'Different copy' } },
      { ...table, conversion: { ...table.conversion!, notes: 'Changed adaptation' } },
    ]
    for (const changed of changes) expect(getConversionReviewStatus(changed)).toBe('stale')
    expect(getConversionReviewStatus(JSON.parse(JSON.stringify(table)))).toBe('reviewed')
  })

  it('canonicalizes harmless object order while preserving shared declaration order', () => {
    const table = markConversionReviewed({ ...parsed(), shared: { first: 'A', second: '{{first}}' } })
    const { name, ...rest } = table
    expect(getConversionReviewStatus({ name, ...rest })).toBe('reviewed')
    expect(getConversionReviewStatus({ ...table, shared: { second: '{{first}}', first: 'A' } })).toBe('stale')
    expect(canonicalConversionContent(table)).not.toContain('reviewedAt')
    expect(canonicalConversionContent(table)).not.toContain('reviewedContent')
  })

  it('does not mark broken coverage reviewed and never substitutes range widths', () => {
    const table = parsed('2d6 Incomplete\n3-5 Low\n7-12 High')
    expect(analyzeConversion(table).errors).toContain('Dice outcomes 2-2 have no entry')
    expect(analyzeConversion(table).errors).toContain('Dice outcomes 6-6 have no entry')
    expect(analyzeConversion(table).probabilities).toBeNull()
    expect(() => markConversionReviewed(table)).toThrow('Resolve table errors')
  })

  it('keeps unreviewed and absent provenance distinct', () => {
    const table = parsed()
    expect(getConversionReviewStatus(table)).toBe('unreviewed')
    expect(getConversionReviewStatus({ ...table, conversion: undefined })).toBe('none')
    expect(getConversionReviewStatus({ ...table, conversion: { ...table.conversion!, reviewedContent: 'arbitrary', reviewedAt: 'invalid' } })).toBe('unreviewed')
  })
})

it('invalidates review when dependent sets or defaultSets declaration order changes', () => {
  const table = markConversionReviewed({ ...parsed(), defaultSets: { first: 'A', second: '{{@first}}' }, entries: parsed().entries.map(entry => ({ ...entry, sets: { first: 'A', second: '{{@first}}' } })) })
  expect(getConversionReviewStatus({ ...table, defaultSets: { second: '{{@first}}', first: 'A' } })).toBe('stale')
  expect(getConversionReviewStatus({ ...table, entries: table.entries.map(entry => ({ ...entry, sets: { second: '{{@first}}', first: 'A' } })) })).toBe('stale')
})

it('requires resolved inherited content before recording review', () => {
  const inherited = { ...parsed(), extends: 'parent', entries: [{ id: 'changed', value: 'Changed' }] }
  expect(() => markConversionReviewed(inherited)).toThrow('requires its current resolved content')
  expect(() => markConversionReviewed(inherited, new Date(), parsed('2d6 Reaction\n3-11 Middle'))).toThrow('Resolve table errors')
  expect(getConversionReviewStatus(markConversionReviewed(inherited, new Date(), parsed()))).toBe('reviewed')
})

it('preserves native singleton ranges when the signed dice domain ends at zero', () => {
  const source = 'd6-6 Signed\n-5 First\n-4 Second\n-3 Third\n-2 Fourth\n-1 Fifth\n0 Zero'
  const table = parsed(source)
  expect(table.entries.map(entry => entry.range)).toEqual([[-5, -5], [-4, -4], [-3, -3], [-2, -2], [-1, -1], [0, 0]])
  expect(table.entries.every(entry => entry.weight === undefined)).toBe(true)
  expect(analyzeConversion(table).errors).toEqual([])
  const engine = engineFor(table)
  for (let face = 1; face <= 6; face++) expect(engine.roll(table.id, 'fixture', { random: () => (face - 0.5) / 6 }).text).toBe(table.entries[face - 1].value)
  expect(getConversionReviewStatus(markConversionReviewed(table))).toBe('reviewed')
})

it('retains zero-ending mixed ranges with negative totals', () => {
  const table = parsed('2d6-12 Signed\n-10- -1 Negative\n0 Zero')
  // The standard unspaced negative range notation is -10--1.
  const valid = parsed('2d6-12 Signed\n-10--1 Negative\n0 Zero')
  expect(valid.entries.map(entry => entry.range)).toEqual([[-10, -1], [0, 0]])
  expect(analyzeConversion(valid).probabilities).toEqual([expect.closeTo(35 / 36), expect.closeTo(1 / 36)])
  expect(table).toBeUndefined() // ambiguous spaced range copy requires correction
})

it('validates source page values with the actual schema alternatives before review', () => {
  for (const page of ['', 'Page 12', '12,14', '12-', 0, -1, 1.5]) {
    const table = { ...parsed(), source: { page } }
    expect(analyzeConversion(table).errors.some(error => error.startsWith('Source page'))).toBe(true)
    expect(() => markConversionReviewed(table)).toThrow('Resolve table errors')
  }
  for (const page of [undefined, 12, '12', '12-14']) {
    const table = { ...parsed(), source: { page } }
    expect(analyzeConversion(table).errors).toEqual([])
    expect(() => engineFor(markConversionReviewed(table))).not.toThrow()
  }
})
