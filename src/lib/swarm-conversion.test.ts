import { describe, expect, it } from 'vitest'
import { parseTableText } from './tableParser'
import { analyzeConversion, getConversionReviewStatus, markConversionReviewed } from './conversionVerification'
import { validateDocument } from '@/engine/core/validator'
import type { SimpleTable } from '@/engine/types'

const table = (range?: [number, number]): SimpleTable => ({ id: 'fate', name: 'Fate', type: 'simple', entries: [{ value: 'Low', ...(range ? { range } : {}) }], conversion: { kind: 'transcription', sourceText: 'Synthetic source' } })
const document = (table: SimpleTable) => ({ metadata: { name: 'Source', namespace: 'test.source', specVersion: '1.1', version: '1.0.0' }, tables: [table] })

describe('swarm: conversion mechanics agree with the engine', () => {
  it.each(['d6 reroll ones Fate', 'd6 (roll twice, take highest) Fate', 'd6 Fate (reroll ones)', 'd6 Fate (take the lowest)', 'd6 Fate (advantage)', 'd6 Fate (disadvantage)', 'd6 Fate (roll with advantage)'])('flags procedures throughout heading %s without inventing odds', heading => {
    const result = parseTableText(`${heading}\n1-3 Low\n4-6 High`)
    expect(result.success).toBe(true)
    expect(result.warnings).toContainEqual(expect.stringContaining('Source procedure detected in the heading'))
    expect(result.table?.selection).toEqual({ mode: 'dice', dice: '1d6' })
    expect(result.table?.conversion?.sourceText).toContain(heading)
    expect(parseTableText('d6 Highest Mountain\n1-3 Low\n4-6 High').warnings).toEqual([])
  })

  it.each([[[-1, 1]], [[0, Number.MAX_SAFE_INTEGER]], [[1, 2, 3]]])('blocks source review and engine loading for invalid weighted range %j', range => {
    const candidate = { ...table(), entries: [{ value: 'Invalid', range }, { value: 'Valid', weight: 1 }] } as SimpleTable
    expect(analyzeConversion(candidate).errors.length).toBeGreaterThan(0)
    expect(analyzeConversion(candidate).probabilities).toBeNull()
    expect(() => markConversionReviewed(candidate)).toThrow('Resolve table errors')
    expect(validateDocument(document(candidate)).valid).toBe(false)
  })

  it.each([Number.MAX_VALUE, Number.MIN_VALUE])('normalizes finite individual weights %s without overflowing sums', weight => {
    const candidate = { ...table(), entries: [{ value: 'Low', weight }, { value: 'High', weight }] }
    expect(analyzeConversion(candidate)).toMatchObject({ errors: [], probabilities: [0.5, 0.5] })
    expect(validateDocument(document(candidate)).valid).toBe(true)
    expect(getConversionReviewStatus(markConversionReviewed(candidate))).toBe('reviewed')
  })

  it('preserves zero weighted outcomes and signed native outcomes', () => {
    expect(analyzeConversion(table([0, 0]))).toMatchObject({ errors: [], probabilities: [1] })
    const native = { ...table([-4, 1]), selection: { mode: 'dice' as const, dice: '1d6-5' } }
    expect(analyzeConversion(native)).toMatchObject({ errors: [], probabilities: [1] })
    const disabled = { ...table(), entries: [{ value: 'Disabled', weight: 0 }, { value: 'Active', weight: Number.MIN_VALUE }] }
    expect(analyzeConversion(disabled)).toMatchObject({ errors: [], probabilities: [0, 1] })
  })
})
