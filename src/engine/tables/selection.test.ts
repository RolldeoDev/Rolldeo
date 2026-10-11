import { describe, expect, it } from 'vitest'
import { createContext } from '../core/context'
import { RandomTableEngine } from '../core'
import type { TraceNode } from '../core/trace'
import { rollCollectionTable, getCollectionProbabilities, mergeTableEntries, selectFromPool } from './collection'
import { buildSourcePool, calculateSourceWeight, getSourceProbabilities, selectSource, validateCompositeTable } from './composite'
import { buildWeightedPool, calculateTotalWeight, getTableProbabilities, selectByWeight, validateSimpleTable } from './simple'
import { getWeight } from './weights'
import type { CollectionTable, CompositeTable, SimpleTable, RandomTableDocument } from '../types'

const simple: SimpleTable = {
  id: 'source', name: 'Source', type: 'simple', defaultSets: { inherited: 'source', override: 'source' },
  resultType: 'sourceType', entries: [
    { id: 'a', value: 'A', sets: { override: 'entry' } }, { id: 'b', value: 'B' },
  ],
}
const collection: CollectionTable = {
  id: 'merged', name: 'Merged', type: 'collection', collections: ['source'],
  defaultSets: { override: 'collection', own: 'collection' },
}
const sources = () => [{ id: 'source', table: simple }]
const context = (behavior: 'cycle' | 'stop' | 'error' = 'cycle') => createContext({
  maxRecursionDepth: 50, maxExplodingDice: 100, maxInheritanceDepth: 10, uniqueOverflowBehavior: behavior,
}, undefined, { random: () => 0 })

describe('engine composed selection regressions', () => {
  const document: RandomTableDocument = {
    metadata: { name: 'Selection regressions', namespace: 'selection.tests', version: '1.0.0', specVersion: '1.0', uniqueOverflowBehavior: 'cycle' },
    tables: [simple, collection,
      { id: 'child', name: 'Child', type: 'simple', extends: 'source', entries: [{ id: 'a', value: 'Disabled A', weight: 0 }] },
      { id: 'inheritedPool', name: 'Inherited Pool', type: 'collection', collections: ['child'] },
    ],
  }
  it('cycles simple and merged multi-rolls without recursion or duplicate refill draws', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(document, 'selection')
    for (const tableId of ['source', 'merged']) {
      const result = engine.evaluateRawPattern(`{{6*unique*${tableId}}}`, 'selection', { random: () => 0 })
      expect(result.text).toBe('A, B, A, B, A, B')
    }
  })
  it('resolves inherited collection sources before merging', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(document, 'selection')
    expect(engine.roll('child', 'selection', { random: () => 0 }).text).toBe('B')
    expect(engine.roll('inheritedPool', 'selection', { random: () => 0 }).text).toBe('B')
  })
  it('rejects a disabled source before engine generation can start', () => {
    const engine = new RandomTableEngine()
    expect(() => engine.loadCollection({ ...document, tables: [
      { id: 'disabled', name: 'Disabled', type: 'simple', entries: [{ value: 'Disabled', weight: 0 }] },
      { id: 'disabledPool', name: 'Disabled Pool', type: 'collection', collections: ['disabled'] },
    ] }, 'selection')).toThrow(/VALIDATION_ERROR/)
  })
})

describe('collection selection', () => {
  it('tracks first refill draw and each subsequent cycle', () => {
    const ctx = context()
    const ids = Array.from({ length: 6 }, () => rollCollectionTable(collection, sources, ctx, { unique: true })?.id)
    expect(ids).toEqual(['source.a', 'source.b', 'source.a', 'source.b', 'source.a', 'source.b'])
    expect(ctx.usedEntries.get('merged')).toEqual(new Set(['source.a', 'source.b']))
  })
  it('preserves permanent exclusions on refill and safely returns null when all excluded', () => {
    const ctx = context()
    const options = { unique: true, excludeIds: new Set(['source.a']) }
    expect(rollCollectionTable(collection, sources, ctx, options)?.id).toBe('source.b')
    expect(rollCollectionTable(collection, sources, ctx, options)?.id).toBe('source.b')
    expect(rollCollectionTable(collection, sources, ctx, { unique: true, excludeIds: new Set(['source.a', 'source.b']) })).toBeNull()
  })
  it('returns null for empty or disabled source pools for every overflow behavior', () => {
    for (const behavior of ['cycle', 'stop', 'error'] as const) {
      const ctx = context(behavior)
      expect(rollCollectionTable(collection, () => [], ctx, { unique: true })).toBeNull()
      expect(rollCollectionTable(collection, () => [{ id: 'disabled', table: {
        ...simple, entries: [{ value: 'Disabled', weight: 0 }],
      } }], ctx, { unique: true })).toBeNull()
    }
  })
  it('honors stop/error after real unique exhaustion', () => {
    for (const behavior of ['stop', 'error'] as const) {
      const ctx = context(behavior)
      rollCollectionTable(collection, sources, ctx, { unique: true })
      rollCollectionTable(collection, sources, ctx, { unique: true })
      if (behavior === 'stop') expect(rollCollectionTable(collection, sources, ctx, { unique: true })).toBeNull()
      else expect(() => rollCollectionTable(collection, sources, ctx, { unique: true })).toThrow(/Unique selection overflow/)
    }
  })
  it('merges source, collection and entry sets in order and retains source result type', () => {
    expect(rollCollectionTable(collection, sources, context())).toMatchObject({
      sourceTableId: 'source', resultType: 'sourceType',
      mergedSets: { inherited: 'source', own: 'collection', override: 'entry', value: 'A' },
    })
  })
})

describe('stable weighted probabilities', () => {
  const enormous: SimpleTable = { ...simple, entries: [
    { id: 'a', value: 'A', weight: 1e308 }, { id: 'b', value: 'B', weight: 1e308 },
  ] }
  const composite: CompositeTable = {
    id: 'choice', name: 'Choice', type: 'composite', sources: [
      { tableId: 'a', weight: 1e308 }, { tableId: 'b', weight: 1e308 },
    ],
  }
  it('samples huge finite weights without overflowing in every selector', () => {
    for (const [random, expected] of [[0, 'a'], [0.75, 'b']] as const) {
      expect(selectByWeight(buildWeightedPool(enormous.entries, 'source'), () => random)?.id).toBe(expected)
      expect(selectFromPool(mergeTableEntries([{ id: 'source', table: enormous }]), () => random)?.id).toBe(`source.${expected}`)
      expect(selectSource(composite, () => random)?.sourceTableId).toBe(expected)
    }
  })
  it('reports finite 50/50 probabilities for huge weights across all table kinds', () => {
    expect(getTableProbabilities(enormous).map((p) => p.probability)).toEqual([0.5, 0.5])
    expect(getCollectionProbabilities(collection, () => [{ id: 'source', table: enormous }]).map((p) => p.probability)).toEqual([0.5, 0.5])
    expect(getSourceProbabilities(composite).map((p) => p.probability)).toEqual([0.5, 0.5])
  })
  it('saturates exported totals consistently without distorting normalized probabilities', () => {
    const maximum: SimpleTable = { ...enormous, entries: enormous.entries.map(entry => ({ ...entry, weight: Number.MAX_VALUE })) }
    const merged = mergeTableEntries([{ id: 'source', table: maximum }])
    expect(merged.totalWeight).toBe(Number.MAX_VALUE)
    expect(calculateTotalWeight(buildWeightedPool(maximum.entries, 'source'))).toBe(Number.MAX_VALUE)
    expect(calculateSourceWeight(buildSourcePool(composite.sources.map(source => ({ ...source, weight: Number.MAX_VALUE }))))).toBe(Number.MAX_VALUE)
    expect(getCollectionProbabilities(collection, () => [{ id: 'source', table: maximum }]).map(entry => entry.probability)).toEqual([0.5, 0.5])
    expect(JSON.parse(JSON.stringify(merged)).totalWeight).toBe(Number.MAX_VALUE)
  })
  it('records finite trace totals and probabilities for overflowing raw weight sums', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection({
      metadata: { name: 'Huge weights', namespace: 'huge.weights', version: '1.0.0', specVersion: '1.0' },
      tables: [enormous, collection, { ...composite, sources: [
        { tableId: 'source', weight: 1e308 }, { tableId: 'merged', weight: 1e308 },
      ] }],
    }, 'huge')
    const flatten = (node: TraceNode): TraceNode[] => [node, ...node.children.flatMap(flatten)]
    for (const id of ['source', 'merged', 'choice']) {
      const result = engine.roll(id, 'huge', { enableTrace: true, random: () => 0 })
      expect(result.text).toBe('A')
      expect(result.trace).toBeDefined()
      const metadata = flatten(result.trace!.root).map(node => node.metadata)
      const selections = metadata.filter(meta => meta?.type === 'entry_select')
      expect(selections.length).toBeGreaterThan(0)
      for (const selection of selections) {
        if (selection?.type !== 'entry_select') continue
        expect(Number.isFinite(selection.totalWeight)).toBe(true)
        expect(selection.probability).toBe(0.5)
      }
      for (const meta of metadata) {
        if (meta?.type === 'composite_select') expect(meta.sources.map(source => source.probability)).toEqual([0.5, 0.5])
      }
    }
  })
  it('uses inclusive width ranges, rejects invalid ranges and excludes nonfinite weights', () => {
    const ranged = getTableProbabilities({ ...simple, entries: [
      { value: 'Wide', range: [1, 9] }, { value: 'Narrow', range: [10, 10] },
    ] })
    expect(ranged[0].probability).toBeCloseTo(0.9)
    expect(ranged[1].probability).toBeCloseTo(0.1)
    for (const range of [[1.5, 2], [1, Infinity], [3, 2], [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]] as [number, number][]) {
      expect(getWeight({ range })).toBe(0)
      expect(validateSimpleTable({ ...simple, entries: [{ value: 'Invalid', range }] }).some((issue) => issue.type === 'error')).toBe(true)
    }
    expect(buildWeightedPool([{ value: 'Invalid', weight: Infinity }, { value: 'Invalid', weight: NaN }], 'invalid')).toEqual([])
    expect(buildSourcePool([{ tableId: 'invalid', weight: Infinity }])).toEqual([])
    expect(validateCompositeTable({ ...composite, sources: [{ tableId: 'a', weight: Infinity }] }, () => true).some((issue) => issue.type === 'error')).toBe(true)
  })
  it('rejects random sources outside the finite unit interval', () => {
    for (const value of [-1, 1, Infinity, NaN]) expect(() => selectSource(composite, () => value)).toThrow(/Random source/)
  })
})
