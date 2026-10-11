import { describe, expect, it } from 'vitest'
import { createContext } from '../core/context'
import { RandomTableEngine } from '../core'
import type { TraceNode } from '../core/trace'
import type { RandomTableDocument, SimpleTable } from '../types'
import { getDiceEntryProbabilities, parseSelectionDice, rollDiceSelection, validateDiceSelection } from './diceSelection'
import { getTableProbabilities, rollSimpleTable, validateSimpleTable } from './simple'
import { mergeTableEntries } from './collection'
import { getWeight } from './weights'
import { computeTableVisualization } from '../../hooks/useTableVisualization'

function reaction(): SimpleTable {
  return { id: 'reaction', name: 'Reaction', type: 'simple', selection: { mode: 'dice', dice: '2d6' },
    entries: Array.from({ length: 11 }, (_, index) => ({ id: `r${index + 2}`, value: String(index + 2), range: [index + 2, index + 2] as [number, number] })) }
}
function engine(tables: RandomTableDocument['tables'] = [reaction()]) {
  const engine = new RandomTableEngine()
  engine.loadCollection({ metadata: { name: 'Dice tables', namespace: 'test.dice', version: '1.0.0', specVersion: '1.1' }, tables }, 'dice')
  return engine
}
function sequence(values: number[]) {
  let index = 0
  return () => {
    if (index >= values.length) throw new Error('Unexpected random draw')
    return values[index++]
  }
}
function context(random: () => number, maxGenerationWork?: number) {
  return createContext({ maxRecursionDepth: 50, maxExplodingDice: 100, maxInheritanceDepth: 10, uniqueOverflowBehavior: 'cycle', maxGenerationWork }, undefined, { random })
}
function traceNodes(node: TraceNode): TraceNode[] { return [node, ...node.children.flatMap(traceNodes)] }

describe('native dice table selection', () => {
  it('rolls two dice and exhaustively reproduces all 36 2d6 combinations', () => {
    const counts = new Array(11).fill(0)
    for (let first = 1; first <= 6; first++) {
      for (let second = 1; second <= 6; second++) {
        const result = rollSimpleTable(reaction(), context(sequence([(first - 0.5) / 6, (second - 0.5) / 6])))!
        expect(result.dice?.rolls).toEqual([first, second])
        expect(result.entry.value).toBe(String(first + second))
        counts[first + second - 2]++
      }
    }
    expect(counts).toEqual([1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1])
    getDiceEntryProbabilities(reaction())!.forEach((probability, index) => expect(probability).toBeCloseTo(counts[index] / 36, 12))
    expect(getTableProbabilities(reaction())[5].percentage).toBe('16.67%')
  })

  it('uses literal d100 lookup, independent of entry ordering', () => {
    const table: SimpleTable = { ...reaction(), selection: { mode: 'dice', dice: ' D100 ' }, entries: [
      { value: 'Rare', range: [96, 100] }, { value: 'Common', range: [1, 95] },
    ] }
    const counts = [0, 0]
    for (let total = 1; total <= 100; total++) counts[rollDiceSelection(table, () => (total - 0.5) / 100).entryIndex]++
    expect(counts).toEqual([5, 95])
    expect(getDiceEntryProbabilities(table)![0]).toBeCloseTo(0.05)
  })

  it('normalizes syntax and supports positive and negative modified outcomes', () => {
    expect(parseSelectionDice(' 2 D 6 + 3 ')).toMatchObject({ expression: '2d6+3', count: 2, sides: 6, modifier: 3, min: 5, max: 15 })
    const table: SimpleTable = { ...reaction(), selection: { mode: 'dice', dice: 'd6-4' }, entries: [
      { value: 'Negative', range: [-3, -1] }, { value: 'Nonnegative', range: [0, 2] },
    ] }
    expect(validateDiceSelection(table)).toEqual([])
    expect(rollDiceSelection(table, () => 0).dice.total).toBe(-3)
    expect(rollDiceSelection(table, () => 0.999).dice.total).toBe(2)
    expect(getDiceEntryProbabilities(table)).toEqual([0.5, 0.5])
    expect(engine([table]).roll('reaction', 'dice', { random: () => 0 }).text).toBe('Negative')
  })

  it.each(['0d6', '1001d6', '2d0', '2d6!', '4d6kh3', '2d6*2', '2d6+$level', '2d6+9007199254740991', '2d9007199254740991'])('rejects unsupported or unsafe selection dice %s', expression => {
    expect(() => parseSelectionDice(expression)).toThrow()
  })

  it('reports range gaps, overlaps, missing ranges, weights and unreachable entries', () => {
    const table: SimpleTable = { ...reaction(), entries: [
      { value: 'First', range: [2, 5] }, { value: 'Overlap', range: [5, 6] },
      { value: 'End', range: [8, 12], weight: 2 }, { value: 'Missing' }, { value: 'Unreachable', range: [20, 30] },
    ] }
    expect(validateDiceSelection(table).map(issue => issue.code)).toEqual(expect.arrayContaining([
      'DICE_RANGE_OVERLAP', 'DICE_RANGE_GAP', 'DICE_WEIGHT_CONFLICT', 'MISSING_DICE_RANGE', 'UNREACHABLE_DICE_RANGE',
    ]))
    expect(() => rollDiceSelection(table, () => 0)).toThrow(/DICE_SELECTION_ERROR/)
    expect(() => engine([table])).toThrow(/VALIDATION_ERROR/)
    expect(validateDiceSelection({ ...reaction(), entries: [{ value: 'Every', range: [0, 99] }] })).toEqual([])
  })

  it('preserves legacy range-width selection when no dice declaration is present', () => {
    const table = reaction()
    delete table.selection
    getTableProbabilities(table).forEach(item => expect(item.probability).toBeCloseTo(1 / 11))
    expect(rollSimpleTable(table, context(sequence([0.5])))?.entry.value).toBe('7')
    expect(engine([table]).roll('reaction', 'dice', { random: () => 0 }).text).toBe('2')
  })

  it('requires spec 1.1 rather than silently changing legacy document semantics', () => {
    const app = new RandomTableEngine()
    expect(() => app.loadCollection({ metadata: { name: 'Legacy', namespace: 'test.legacy', version: '1.0.0', specVersion: '1.0' }, tables: [reaction()] }, 'legacy')).toThrow(/VALIDATION_ERROR/)
  })

  it('bounds probability computation while preserving tiny tail probabilities', () => {
    const table: SimpleTable = { ...reaction(), selection: { mode: 'dice', dice: '100d2' }, entries: [
      { value: 'Minimum', range: [100, 100] }, { value: 'Other', range: [101, 200] },
    ] }
    expect(getDiceEntryProbabilities(table)![0] / (2 ** -100)).toBeCloseTo(1, 12)
    const deterministic: SimpleTable = { ...reaction(), selection: { mode: 'dice', dice: '1000d1-1001' }, entries: [{ value: 'Negative one', range: [-1, -1] }] }
    expect(getDiceEntryProbabilities(deterministic)).toEqual([1])
    expect(rollDiceSelection(deterministic, () => 0).dice.total).toBe(-1)
  })

  it('rejects unique, excluded entries, collection pooling and invalid random values', () => {
    const table = reaction()
    expect(() => rollSimpleTable(table, context(() => 0), { unique: true })).toThrow(/does not support unique/)
    expect(() => rollSimpleTable(table, context(() => 0), { excludeIds: new Set(['r2']) })).toThrow(/excluded entries/)
    expect(() => mergeTableEntries([{ id: 'reaction', table }])).toThrow(/cannot be pooled/)
    expect(() => rollDiceSelection(table, () => 1)).toThrow(/Random source/)
    expect(() => rollSimpleTable(table, context(() => 0, 1))).toThrow(/Generation work limit/)
  })

  it('supports nested tables and composite delegation and traces the actual dice', () => {
    const app = engine([reaction(),
      { id: 'outer', name: 'Outer', type: 'simple', entries: [{ value: 'Reaction {{reaction}}' }] },
      { id: 'composed', name: 'Composed', type: 'composite', sources: [{ tableId: 'reaction' }] },
    ])
    const nested = app.roll('outer', 'dice', { random: sequence([0, 0, 0.99]) })
    expect(nested.text).toBe('Reaction 7')
    expect(nested.placeholders?.value).toBe('Reaction 7')
    const result = app.roll('composed', 'dice', { random: sequence([0, 0, 0.99]), enableTrace: true })
    expect(result.text).toBe('7')
    const nodes = traceNodes(result.trace!.root)
    expect(nodes.find(node => node.type === 'dice_roll')?.metadata).toMatchObject({ expression: '2d6', rolls: [1, 6], breakdown: '[1, 6] = 7' })
    expect(nodes.filter(node => node.type === 'entry_select')).toHaveLength(0)
    expect(() => app.evaluateRawPattern('{{2*unique*composed}}', 'dice', { random: () => 0 })).toThrow(/DICE_SELECTION_ERROR/)
  })

  it('inherits dice selection and rejects again instead of altering source probabilities', () => {
    const parent = reaction()
    const app = engine([parent, { id: 'child', name: 'Child', type: 'simple', extends: 'reaction', entries: [{ id: 'r2', value: 'Changed' }] }])
    expect(app.roll('child', 'dice', { random: sequence([0, 0]) }).text).toBe('Changed')
    const again = engine([{ ...parent, entries: [{ value: '{{again}}', range: [2, 12] }] }])
    expect(() => again.roll('reaction', 'dice', { random: () => 0 })).toThrow(/excluded entries/)
  })

  it('rejects signed ranges in weighted imported overrides after their ancestor loads', () => {
    const app = new RandomTableEngine()
    app.loadCollection({ metadata: { name: 'Child', namespace: 'test.signedchild', version: '1.0.0', specVersion: '1.1' },
      imports: [{ path: 'test.weightedparent', alias: 'parent' }], tables: [
        { id: 'child', name: 'Child', type: 'simple', extends: 'parent.reaction', entries: [{ id: 'r2', range: [-3, -1] }] },
        { id: 'pool', name: 'Pool', type: 'collection', collections: ['child'] },
      ],
    }, 'child')
    const parent = reaction()
    delete parent.selection
    app.loadCollection({ metadata: { name: 'Parent', namespace: 'test.weightedparent', version: '1.0.0', specVersion: '1.0' }, tables: [parent] }, 'parent')
    expect(() => app.roll('child', 'child', { random: () => 0 })).toThrow(/Signed ranges.*require native dice/)
    expect(() => app.roll('pool', 'child', { random: () => 0 })).toThrow(/Signed ranges.*require native dice/)
    expect(() => computeTableVisualization(app, 'child', 'child')).toThrow(/Signed ranges.*require native dice/)
    expect(getWeight({ range: [-3, -1] })).toBe(0)
  })

  it('preserves signed native ranges inherited through a later-loaded import', () => {
    const app = new RandomTableEngine()
    app.loadCollection({ metadata: { name: 'Child', namespace: 'test.nativechild', version: '1.0.0', specVersion: '1.1' },
      imports: [{ path: 'test.nativeparent', alias: 'parent' }], tables: [
        { id: 'child', name: 'Child', type: 'simple', extends: 'parent.reaction', entries: [{ id: 'negative', value: 'Changed negative', range: [-3, -1] }] },
      ],
    }, 'child')
    const parent: SimpleTable = { ...reaction(), selection: { mode: 'dice', dice: 'd6-4' }, entries: [
      { id: 'negative', value: 'Negative', range: [-3, -1] }, { id: 'other', value: 'Other', range: [0, 2] },
    ] }
    app.loadCollection({ metadata: { name: 'Parent', namespace: 'test.nativeparent', version: '1.0.0', specVersion: '1.1' }, tables: [parent] }, 'parent')
    expect(app.roll('child', 'child', { random: () => 0 }).text).toBe('Changed negative')
    expect(app.roll('child', 'child', { random: () => 0.99 }).text).toBe('Other')
    expect(validateSimpleTable(parent)).toEqual([])
  })

  it('shows actual 2d6 probabilities and explicitly withholds oversized charts', () => {
    const chart = computeTableVisualization(engine(), 'dice', 'reaction')!
    if (chart.type !== 'simple') throw new Error('Expected simple chart')
    expect(chart.selectionDice).toBe('2d6')
    expect(chart.entries[0].probability).toBeCloseTo(100 / 6)
    const large: SimpleTable = { ...reaction(), selection: { mode: 'dice', dice: 'd1000000' }, entries: [{ value: 'Everything', range: [1, 1_000_000] }] }
    expect(getDiceEntryProbabilities(large)).toBeNull()
    const unavailable = computeTableVisualization(engine([large]), 'dice', 'reaction')!
    if (unavailable.type !== 'simple') throw new Error('Expected simple chart')
    expect(unavailable.entries).toEqual([])
    expect(unavailable.probabilityUnavailable).toMatch(/calculation limits/)
    expect(unavailable.totalEntries).toBe(1)
    expect(rollDiceSelection(large, () => 0.5).dice.total).toBe(500001)
  })
})
