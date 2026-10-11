import { describe, expect, it, vi } from 'vitest'
import Ajv from 'ajv'
import schema from '../../../public/schemas/random-table-spec-v1.0.json'
import { validateDocument } from './validator'
import { RandomTableEngine } from './index'
import { preloadedCollections } from '../../data/preloaded'

const document = () => ({
  metadata: { name: 'Conformance', namespace: 'test.conformance', version: '1.0.0', specVersion: '1.0' },
  tables: [{ id: 'base', name: 'Base', type: 'simple', entries: [{ id: 'first', value: 'First' }] }],
})

describe('Document validation boundaries', () => {
  const structurallyValid = new Ajv({ strict: false, strictNumbers: true, validateFormats: false }).compile(schema)

  it.each([0, 1000])('accepts exploding-dice limit %s in schema, validation and runtime', (maxExplodingDice) => {
    const doc = document()
    const input = { ...doc, metadata: { ...doc.metadata, maxExplodingDice }, tables: [{ ...doc.tables[0], type: 'simple' as const, entries: [{ value: '{{dice:1d1!}}' }] }] }
    expect(structurallyValid(input)).toBe(true)
    expect(validateDocument(input).valid).toBe(true)
    const engine = new RandomTableEngine()
    engine.loadCollection({ ...input, metadata: { ...input.metadata, specVersion: '1.0' } }, 'test')
    expect(engine.roll('base', 'test', { random: () => 0 }).text).toBe(String(maxExplodingDice + 1))
  })

  it.each([-1, 1001, 0.5, Number.MAX_SAFE_INTEGER, Infinity, NaN])('rejects exploding-dice limit %s before generation', (maxExplodingDice) => {
    const doc = document()
    const input = { ...doc, metadata: { ...doc.metadata, maxExplodingDice } }
    expect(structurallyValid(input)).toBe(false)
    expect(validateDocument(input).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_CONFIG' }))
  })

  it('preserves safe inclusive range widths at the integer boundary', () => {
    const doc = document()
    const withRange = (range: number[]) => ({ ...doc, tables: [{ ...doc.tables[0], entries: [{ value: 'entry', range }] }] })
    for (const range of [[0, Number.MAX_SAFE_INTEGER - 1], [1, Number.MAX_SAFE_INTEGER], [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]]) {
      expect(structurallyValid(withRange(range))).toBe(true)
      expect(validateDocument(withRange(range)).valid).toBe(true)
    }
    expect(structurallyValid(withRange([0, Number.MAX_SAFE_INTEGER]))).toBe(false)
    expect(validateDocument(withRange([0, Number.MAX_SAFE_INTEGER])).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_RANGE' }))
  })

  it.each(['composite', 'collection'])('rejects unsupported %s inheritance structurally', (type) => {
    const doc = document()
    const table = { id: 'child', name: 'Child', type, extends: 'base', ...(type === 'composite' ? { sources: [{ tableId: 'base' }] } : { collections: ['base'] }) }
    const input = { ...doc, tables: [...doc.tables, table] }
    expect(structurallyValid(input)).toBe(false)
    expect(validateDocument(input).errors).toContainEqual(expect.objectContaining({ code: 'UNSUPPORTED_INHERITANCE' }))
  })

  it('requires simple collection sources locally and after dependency linking', () => {
    const doc = document()
    const composite = { id: 'combo', name: 'Composite', type: 'composite' as const, sources: [{ tableId: 'base' }] }
    const collection = { id: 'pool', name: 'Pool', type: 'collection' as const, collections: ['combo'] }
    expect(validateDocument({ ...doc, tables: [...doc.tables, composite, collection] }).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_COLLECTION_SOURCE_TYPE' }))
    const external = { ...doc, tables: [{ ...collection, collections: ['imported.combo'] }] }
    expect(validateDocument(external).valid).toBe(true)
    expect(validateDocument(external, { resolveTable: () => composite }).valid).toBe(false)
    expect(validateDocument(external, { resolveTable: () => undefined }).valid).toBe(false)
    expect(validateDocument(external, { resolveTable: () => ({ ...doc.tables[0], type: 'simple' }) }).valid).toBe(true)
  })

  it('accepts optional-property and map-key null deletion only on inherited IDs', () => {
    const doc = document()
    const overrides = [
      { id: 'first', weight: null, range: null, description: null, tags: null, resultType: null, sets: null, assets: null },
      { id: 'first', sets: { hp: null, ac: '16' }, assets: { image: null, token: 'token.png' } },
      { id: 'first', weight: 0, range: null },
      { id: 'first', weight: null, range: [1, 3] },
    ]
    for (const entry of overrides) {
      const input = { ...doc, tables: [...doc.tables, { id: 'child', name: 'Child', type: 'simple', extends: 'base', entries: [entry] }] }
      expect(structurallyValid(input), JSON.stringify(structurallyValid.errors)).toBe(true)
      expect(validateDocument(input).valid).toBe(true)
      const invalidTarget = { ...input, tables: [...doc.tables, { ...input.tables[1], entries: [{ ...entry, id: 'missing', value: 'New' }] }] }
      expect(validateDocument(invalidTarget).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_OVERRIDE_TARGET' }))
      expect(validateDocument({ ...input, tables: [{ ...input.tables[1], extends: undefined }] }).valid).toBe(false)
    }
    expect(validateDocument({ ...doc, tables: [...doc.tables, { id: 'child', name: 'Child', type: 'simple', extends: 'base', entries: [{ id: 'first', value: null }] }] }).valid).toBe(false)
  })

  it('checks inheritance edge limits independently and resolves external ancestors in their owner context', () => {
    const doc = document()
    const child = { id: 'child', name: 'Child', type: 'simple' as const, extends: 'base', entries: [{ id: 'first', weight: 2 }] }
    const leaf = { ...child, id: 'leaf', extends: 'child' }
    const input = { ...doc, metadata: { ...doc.metadata, maxInheritanceDepth: 1 }, tables: [...doc.tables, child, leaf] }
    expect(validateDocument(input).errors).toContainEqual(expect.objectContaining({ code: 'INHERITANCE_DEPTH_LIMIT' }))
    expect(validateDocument({ ...input, metadata: { ...input.metadata, maxInheritanceDepth: 2 } }).valid).toBe(true)
    const foreign = { ...child, extends: 'foreignBase' }
    const foreignBase = { ...doc.tables[0], type: 'simple' as const, id: 'foreignBase' }
    const resolveTable = vi.fn((reference: string, owner?: { id: string }) => reference === 'imported.child' ? foreign : owner === foreign && reference === 'foreignBase' ? foreignBase : undefined)
    const external = { ...doc, tables: [{ ...leaf, extends: 'imported.child' }] }
    expect(validateDocument(external, { resolveTable }).valid).toBe(true)
    expect(resolveTable).toHaveBeenCalledWith('foreignBase', foreign)
  })

  it('allows table/template ID collisions with a warning and preserves arbitrary asset keys', () => {
    const doc = document()
    const input = { ...doc, templates: [{ id: 'base', name: 'Template', pattern: '' }], tables: [{ ...doc.tables[0], entries: [{ value: 'entry', assets: JSON.parse('{"__proto__":"asset.png","constructor":"other.png"}') }] }] }
    const result = validateDocument(input)
    expect(result.valid).toBe(true)
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'ID_COLLISION' }))
    expect(Object.keys(input.tables[0].entries[0].assets)).toEqual(['__proto__', 'constructor'])
  })

  it.each([null, [], 1, 'text', {}, { metadata: null, tables: [] }, { metadata: document().metadata, tables: [null] }])('rejects malformed unknown input without throwing: %j', (input) => {
    expect(validateDocument(input).valid).toBe(false)
  })

  it('supports template-only and static-variable libraries with the required empty tables array', () => {
    expect(validateDocument({ ...document(), tables: [], variables: { greeting: 'Hello' }, templates: [{ id: 'greetingTemplate', name: 'Greeting', pattern: '{{$greeting}}' }] }).valid).toBe(true)
  })

  it('keeps legacy namespaces readable with a migration warning', () => {
    const doc = document()
    const result = validateDocument({ ...doc, metadata: { ...doc.metadata, namespace: 'legacy' } })
    expect(result.valid).toBe(true)
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'LEGACY_NAMESPACE' }))
  })

  it('rejects duplicate import aliases and reserved names consistently', () => {
    const doc = document()
    expect(validateDocument({ ...doc, imports: [{ path: 'first.json', alias: 'dependency' }, { path: 'second.json', alias: 'dependency' }] }).errors).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_IMPORT_ALIAS' }))
    expect(validateDocument({ ...doc, variables: { $DICE: 'value' } }).valid).toBe(false)
    expect(validateDocument({ ...doc, tables: [{ ...doc.tables[0], id: 'DICE' }] }).valid).toBe(false)
  })

  it('accepts finite individual weights when stable normalization handles overflowing raw sums', () => {
    const doc = document()
    expect(validateDocument({ ...doc, tables: [{ ...doc.tables[0], entries: [{ value: 'first', weight: Number.MAX_VALUE }, { value: 'second', weight: Number.MAX_VALUE }] }] }).valid).toBe(true)
  })

  it('rejects obsolete root conditionals with an actionable migration diagnostic', () => {
    expect(validateDocument({ ...document(), conditionals: [] }).errors).toContainEqual(expect.objectContaining({ code: 'OBSOLETE_CONDITIONALS' }))
  })

  it('rejects unknown and wrong-type table properties', () => {
    const doc = document()
    expect(validateDocument({ ...doc, tables: [{ ...doc.tables[0], entires: [] }] }).valid).toBe(false)
    expect(validateDocument({ ...doc, tables: [{ ...doc.tables[0], sources: [] }] }).valid).toBe(false)
  })

  it('checks duplicate table/template and effective generated entry IDs', () => {
    const doc = document()
    expect(validateDocument({ ...doc, tables: [...doc.tables, ...doc.tables] }).errors).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_TABLE_ID' }))
    const template = { id: 'template', name: 'Template', pattern: '{{base}}' }
    expect(validateDocument({ ...doc, templates: [template, template] }).errors).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_TEMPLATE_ID' }))
    expect(validateDocument({ ...doc, tables: [{ ...doc.tables[0], entries: [{ value: 'generated' }, { id: 'base000', value: 'explicit' }] }] }).errors).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_ENTRY_ID' }))
  })

  it('requires inherited value-less overrides to identify an actual parent entry', () => {
    const doc = document()
    const child = { id: 'child', name: 'Child', type: 'simple', extends: 'base', entries: [{ id: 'first', weight: 0 }] }
    expect(validateDocument({ ...doc, tables: [...doc.tables, child] }).valid).toBe(true)
    expect(validateDocument({ ...doc, tables: [...doc.tables, { ...child, entries: [{ id: 'missing' }] }] }).errors).toContainEqual(expect.objectContaining({ code: 'INVALID_OVERRIDE_TARGET' }))
    expect(validateDocument({ ...doc, tables: [{ ...child, extends: undefined }] }).valid).toBe(false)
    const external = { ...child, extends: 'imported.base' }
    expect(validateDocument({ ...doc, tables: [external] }).valid).toBe(true)
    expect(validateDocument({ ...doc, tables: [external] }, { resolveTable: () => ({ ...doc.tables[0], type: 'simple', entries: [{ id: 'another', value: 'Another' }] }) }).valid).toBe(false)
  })

  it('rejects normalized shared aliases and shadows of static or document names', () => {
    const doc = document()
    expect(validateDocument({ ...doc, shared: { hero: '{{base}}', $hero: '{{base}}' } }).errors).toContainEqual(expect.objectContaining({ code: 'SHARED_SHADOW' }))
    expect(validateDocument({ ...doc, variables: { hero: 'static' }, templates: [{ id: 'template', name: 'Template', pattern: '', shared: { $hero: '{{base}}' } }] }).valid).toBe(false)
  })

  it.each(['description', 'value', 'count', '0', '_key', 'bad-key'])('rejects invalid set key %s', (key) => {
    const doc = document()
    expect(validateDocument({ ...doc, tables: [{ ...doc.tables[0], defaultSets: { [key]: 'value' } }] }).valid).toBe(false)
  })

  it.each([Infinity, -Infinity, NaN, -1])('rejects nonfinite or negative weight %s', (weight) => {
    const doc = document()
    expect(validateDocument({ ...doc, tables: [{ ...doc.tables[0], entries: [{ value: 'entry', weight }] }] }).valid).toBe(false)
  })

  it('requires integer ordered nonnegative range endpoints and finite configuration', () => {
    const doc = document()
    for (const range of [[4, 2], [-1, 3], [1.5, 2], [1, Infinity]]) expect(validateDocument({ ...doc, tables: [{ ...doc.tables[0], entries: [{ value: 'entry', range }] }] }).valid).toBe(false)
    for (const maxRecursionDepth of [Infinity, NaN, 1.2, 0]) expect(validateDocument({ ...doc, metadata: { ...doc.metadata, maxRecursionDepth } }).valid).toBe(false)
  })
})

describe('Bundled content conformance', () => {
  const structurallyValid = new Ajv({ strict: false, strictNumbers: true, validateFormats: false }).compile(schema)
  for (const collection of preloadedCollections) {
    it(`${collection.id} passes structural and semantic validation`, () => {
      expect(structurallyValid(collection.document), JSON.stringify(structurallyValid.errors)).toBe(true)
      expect(validateDocument(collection.document).errors).toEqual([])
    })
  }

  it('every bundled template executes without warnings under repeated deterministic selections', () => {
    const engine = new RandomTableEngine()
    for (const collection of preloadedCollections) engine.loadCollection(collection.document, collection.id)
    engine.resolveImports()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const random = vi.spyOn(Math, 'random')
    try {
      // Vary selections and dice over repeated runs without relying on flaky random coverage.
      for (let seed = 1; seed <= 8; seed++) {
        let state = seed
        random.mockImplementation(() => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 })
        for (const collection of preloadedCollections) for (const template of collection.document.templates ?? []) {
          warning.mockClear()
          const result = engine.rollTemplate(template.id, collection.id)
          expect(result.text.length, `${collection.id}/${template.id} seed ${seed}`).toBeGreaterThan(0)
          expect(warning.mock.calls, `${collection.id}/${template.id} seed ${seed}`).toEqual([])
        }
      }
    } finally { warning.mockRestore(); random.mockRestore() }
  })
})
