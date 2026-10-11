import { describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import schema10 from '../../../public/schemas/random-table-spec-v1.0.json'
import schema11 from '../../../public/schemas/random-table-spec-v1.1.json'
import { validateDocument, validateDocumentStructure } from './validator'
import { markConversionReviewed } from '../../lib/conversionVerification'
import type { SimpleTable } from '../types'

const document = (specVersion = '1.1') => ({
  metadata: { name: 'Contracts', namespace: 'test.contracts', version: '1.0.0', specVersion },
  tables: [{ id: 'reaction', name: 'Reaction', type: 'simple', entries: [{ value: 'Neutral', range: [2, 12] }] }],
})
const ajv = new Ajv({ strict: false, strictNumbers: true, validateFormats: false })
const check10 = ajv.compile(schema10)
const check11 = ajv.compile(schema11)

describe('Additive specification 1.1 contracts', () => {
  it('preserves opt-in schema boundaries and ordinary range behavior', () => {
    expect(validateDocument(document('1.0')).valid).toBe(true)
    expect(validateDocument(document()).valid).toBe(true)
    expect(check10(document())).toBe(false)
    expect(check11(document('1.0'))).toBe(false)
    const withInputs = { ...document(), inputs: { terrain: { type: 'text', default: 'forest' } } }
    expect(check11(withInputs)).toBe(true)
    expect(validateDocument(withInputs).valid).toBe(true)
    expect(validateDocument({ ...withInputs, metadata: document('1.0').metadata }).valid).toBe(false)
  })

  it('validates native ranges against dice support, rather than range width', () => {
    const doc = document()
    const table = { ...doc.tables[0], selection: { mode: 'dice', dice: '2d6' } }
    expect(validateDocument({ ...doc, tables: [table] }).valid).toBe(true)
    expect(validateDocument({ ...doc, tables: [{ ...table, entries: [{ value: 'Gap', range: [3, 12] }] }] }).errors).toContainEqual(expect.objectContaining({ code: 'DICE_RANGE_GAP' }))
    expect(validateDocument({ ...doc, tables: [{ ...table, entries: [{ value: 'A', range: [2, 7] }, { value: 'B', range: [7, 12] }] }] }).errors).toContainEqual(expect.objectContaining({ code: 'DICE_RANGE_OVERLAP' }))
    expect(validateDocument({ ...doc, tables: [{ ...table, entries: [{ value: 'No range' }] }] }).errors).toContainEqual(expect.objectContaining({ code: 'MISSING_DICE_RANGE' }))
    expect(validateDocument({ ...doc, tables: [{ ...table, selection: { mode: 'dice', dice: '2d6+$level' } }] }).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_DICE_SELECTION' }))
  })

  it('supports negative outcomes only under the opted-in schema', () => {
    const doc = document()
    const table = { ...doc.tables[0], selection: { mode: 'dice', dice: '1d6-5' }, entries: [{ value: 'All', range: [-4, 1] }] }
    expect(validateDocument({ ...doc, tables: [table] }).valid).toBe(true)
    expect(check10({ ...document('1.0'), tables: [{ ...doc.tables[0], entries: table.entries }] })).toBe(false)
  })

  it('requires nonnegative ranges for weighted tables, including inherited overrides', () => {
    const doc = document()
    const weighted = { ...doc.tables[0], entries: [{ id: 'first', value: 'All', range: [-4, 1] }] }
    expect(check11({ ...doc, tables: [weighted] })).toBe(false)
    expect(validateDocument({ ...doc, tables: [weighted] }).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_RANGE' }))
    const base = { ...weighted, entries: [{ id: 'first', value: 'All', range: [1, 6] }] }
    const child = { id: 'child', name: 'Child', type: 'simple', extends: 'reaction', entries: [{ id: 'first', range: [-4, 1] }] }
    const inherited = { ...doc, tables: [base, child] }
    // Structure cannot inspect referenced ancestors; semantic validation must resolve them.
    expect(check11(inherited)).toBe(true)
    expect(validateDocument(inherited).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_RANGE', path: 'tables[1].entries[0].range' }))
    const native = { ...base, selection: { mode: 'dice', dice: '1d6-5' }, entries: weighted.entries }
    expect(check11({ ...doc, tables: [native, child] })).toBe(true)
    expect(validateDocument({ ...doc, tables: [native, child] }).valid).toBe(true)
    expect(validateDocument({ ...doc, tables: [base, { ...child, selection: { mode: 'dice', dice: '1d6-5' } }] }).valid).toBe(true)
  })

  it('resolves signed imported overrides in their originating namespace', () => {
    const doc = document()
    const child = { id: 'child', name: 'Child', type: 'simple', extends: 'external.parent', entries: [{ id: 'first', range: [-4, 1] }] }
    const importedBase: SimpleTable = { id: 'base', name: 'Imported base', type: 'simple', entries: [{ id: 'first', value: 'All', range: [1, 6] }] }
    const importedParent: SimpleTable = { id: 'parent', name: 'Imported parent', type: 'simple', extends: 'base', entries: [{ id: 'first', value: 'Override' }] }
    const localNamesake = { ...doc.tables[0], id: 'base', selection: { mode: 'dice', dice: '1d6-5' }, entries: [{ id: 'first', value: 'All', range: [-4, 1] }] }
    const input = { ...doc, tables: [localNamesake, child] }
    expect(validateDocument(input).valid).toBe(true) // Deferred until imports are linked.
    const resolveTable = (reference: string) => reference === 'external.parent' ? importedParent : reference === 'base' ? importedBase : undefined
    expect(validateDocument(input, { resolveTable }).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_RANGE' }))
    const nativeBase = { ...importedBase, selection: { mode: 'dice' as const, dice: '1d6-5' }, entries: localNamesake.entries } as SimpleTable
    expect(validateDocument(input, { resolveTable: (reference) => reference === 'external.parent' ? importedParent : reference === 'base' ? nativeBase : undefined }).valid).toBe(true)
  })

  it('does not silently flatten dice selection through collection pooling', () => {
    const doc = document()
    const table = { ...doc.tables[0], selection: { mode: 'dice', dice: '2d6' } }
    const pool = { id: 'pool', name: 'Pool', type: 'collection', collections: ['reaction'] }
    expect(validateDocument({ ...doc, tables: [table, pool] }).errors).toContainEqual(expect.objectContaining({ code: 'DICE_COLLECTION_UNSUPPORTED' }))
    const composite = { id: 'delegate', name: 'Delegate', type: 'composite', sources: [{ tableId: 'reaction' }] }
    expect(validateDocument({ ...doc, tables: [table, composite] }).valid).toBe(true)
    const inherited = { id: 'child', name: 'Child', type: 'simple', extends: 'reaction', entries: [{ id: 'reaction000', value: 'Updated' }] }
    expect(validateDocument({ ...doc, tables: [table, inherited, { ...pool, collections: ['child'] }] }).errors).toContainEqual(expect.objectContaining({ code: 'DICE_COLLECTION_UNSUPPORTED' }))
  })

  it('rejects invalid typed defaults, unsafe numbers, bounds and choices', () => {
    const withInput = (input: unknown) => ({ ...document(), inputs: { level: input } })
    expect(validateDocument(withInput({ type: 'integer', min: 1, max: 20, default: 3 })).valid).toBe(true)
    expect(validateDocument(withInput({ type: 'integer', min: 20, max: 1 })).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_INPUT_BOUNDS' }))
    expect(validateDocument(withInput({ type: 'integer', min: 1, default: 0 })).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_INPUT_DEFAULT' }))
    expect(validateDocument(withInput({ type: 'choice', options: ['forest'], default: 'desert' })).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_INPUT_DEFAULT' }))
    for (const input of [{ type: 'integer', default: 1.5 }, { type: 'integer', default: Number.MAX_SAFE_INTEGER + 1 }, { type: 'boolean', default: 'false' }, { type: 'choice', options: [] }, { type: 'choice', options: ['a', 'a'] }, { type: 'text', default: 2 }]) {
      expect(validateDocumentStructure(withInput(input)).valid).toBe(false)
    }
  })

  it('reserves literal input names across static and all shared scopes', () => {
    const doc = { ...document(), inputs: { terrain: { type: 'text' } } }
    const conflicts = [
      { ...doc, variables: { terrain: 'desert' } },
      { ...doc, shared: { $terrain: 'desert' } },
      { ...doc, tables: [{ ...doc.tables[0], shared: { terrain: 'desert' } }] },
      { ...doc, templates: [{ id: 'summary', name: 'Summary', pattern: 'x', shared: { terrain: 'desert' } }] },
    ]
    for (const input of conflicts) expect(validateDocument(input).errors).toContainEqual(expect.objectContaining({ code: 'INPUT_NAME_CONFLICT' }))
    expect(validateDocument({ ...document(), inputs: { dice: { type: 'text' } } }).errors).toContainEqual(expect.objectContaining({ code: 'RESERVED_WORD' }))
    expect(validateDocumentStructure({ ...document(), inputs: { $terrain: { type: 'text' } } }).valid).toBe(false)
  })

  it('accepts review snapshots only under 1.1 and rejects independent verified claims', () => {
    const doc = document()
    const table = { ...doc.tables[0], conversion: { kind: 'adaptation', sourceText: 'Source', notes: 'Adapted mechanics', reviewedContent: '{}' } }
    expect(validateDocumentStructure({ ...doc, tables: [table] }).valid).toBe(true)
    expect(validateDocumentStructure({ ...document('1.0'), tables: [table] }).valid).toBe(false)
    expect(validateDocumentStructure({ ...doc, tables: [{ ...table, conversion: { ...table.conversion, status: 'verified' } }] }).valid).toBe(false)
  })

  it('warns when edits invalidate an explicit source review without blocking use', () => {
    const doc = document()
    const reviewed = markConversionReviewed({ ...doc.tables[0], conversion: { kind: 'transcription', sourceText: '2–12 Neutral' } } as SimpleTable)
    expect(validateDocument({ ...doc, tables: [reviewed] }).warnings).not.toContainEqual(expect.objectContaining({ code: 'STALE_CONVERSION_REVIEW' }))
    const edited = { ...reviewed, entries: [{ value: 'Hostile', range: [2, 12] }] }
    const validation = validateDocument({ ...doc, tables: [edited] })
    expect(validation.valid).toBe(true)
    expect(validation.warnings).toContainEqual(expect.objectContaining({ code: 'STALE_CONVERSION_REVIEW' }))
  })
})
