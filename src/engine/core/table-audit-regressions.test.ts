import { describe, expect, it } from 'vitest'
import { RandomTableEngine } from './index'
import type { AuthoredRandomTableDocument, AuthoredTable } from '../types'
import type { TraceNode, EntrySelectMetadata } from './trace'
import { rollDice } from '../dice'

function document(namespace: string, tables: AuthoredTable[], overflow: 'stop' | 'cycle' | 'error' = 'stop'): AuthoredRandomTableDocument {
  return { metadata: { name: namespace, namespace, version: '1.0.0', specVersion: '1.0', uniqueOverflowBehavior: overflow }, tables }
}
const items = (id: string, values: string[]): AuthoredTable => ({ id, name: id, type: 'simple', entries: values.map((value, i) => ({ id: `entry${i}`, value })) })
const selections = (node: TraceNode): EntrySelectMetadata[] => [
  ...(node.metadata?.type === 'entry_select' ? [node.metadata] : []), ...node.children.flatMap(selections),
]

function imported() {
  const engine = new RandomTableEngine()
  engine.loadCollection(document('audit.caller', []), 'caller')
  engine.loadCollection(document('audit.left', [items('items', ['A', 'B']), { id: 'merged', name: 'Merged', type: 'collection', collections: ['items'] }]), 'left')
  engine.loadCollection(document('audit.right', [items('items', ['C', 'D']), { id: 'merged', name: 'Merged', type: 'collection', collections: ['items'] }]), 'right')
  return engine
}

describe('table audit composition regressions', () => {
  it('keeps simple and collection uniqueness separate across collection owners', () => {
    const engine = imported()
    for (const id of ['items', 'merged']) {
      expect(engine.evaluateRawPattern(`{{1*unique*audit.left.${id}}}|{{1*unique*audit.right.${id}}}`, 'caller', { random: () => 0 }).text).toBe('A|C')
    }
  })

  it('does not duplicate collection outcomes when aliases name the same resolved source', () => {
    const engine = imported()
    const caller = document('audit.caller', [{ id: 'merged', name: 'Merged', type: 'collection', collections: ['left.items', 'audit.left.items'] }])
    caller.imports = [{ alias: 'left', path: 'audit.left' }]
    engine.updateDocument('caller', caller)
    const result = engine.evaluateRawPattern('{{3*unique*merged}}', 'caller', { random: () => 0, enableTrace: true })
    expect(result.text).toBe('A, B')
    expect(selections(result.trace!.root).map(draw => draw.poolSize)).toEqual([2, 1])
  })

  it('qualifies composite entry IDs and skips sources with exhausted unique outcomes', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(document('audit.composite', [items('a', ['A']), items('b', ['B']), {
      id: 'combo', name: 'Combo', type: 'composite', sources: [{ tableId: 'a', weight: 9 }, { tableId: 'b' }],
    }]), 'main')
    const result = engine.evaluateRawPattern('{{3*unique*combo}}', 'main', { random: () => 0, enableTrace: true })
    expect(result.text).toBe('A, B')
    const nodes = result.trace!.root.children.flatMap(function flatten(node): TraceNode[] { return [node, ...node.children.flatMap(flatten)] })
    const draws = nodes.filter(node => node.metadata?.type === 'composite_select')
    expect(draws).toHaveLength(2)
    expect(draws[1].metadata).toMatchObject({ sources: [{ tableId: 'b', probability: 1 }] })
  })

  it('qualifies nested composite outcomes and keeps composite uniqueness independent of standalone source rolls', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(document('audit.nested', [items('a', ['A']), items('b', ['B']),
      { id: 'inner', name: 'Inner', type: 'composite', sources: [{ tableId: 'a' }, { tableId: 'b' }] },
      { id: 'outer', name: 'Outer', type: 'composite', sources: [{ tableId: 'inner' }] },
    ]), 'main')
    expect(engine.evaluateRawPattern('{{1*unique*a}}|{{2*unique*outer}}|{{2*unique*inner}}', 'main', { random: () => 0 }).text).toBe('A|A, B|A, B')
  })

  it.each(['cycle', 'stop', 'error'] as const)('honors composite %s overflow only after all sources are exhausted', behavior => {
    const engine = new RandomTableEngine()
    engine.loadCollection(document('audit.overflow', [items('a', ['A']), items('b', ['B']), {
      id: 'combo', name: 'Combo', type: 'composite', sources: [{ tableId: 'a' }, { tableId: 'b' }],
    }], behavior), 'main')
    const draw = () => engine.evaluateRawPattern('{{5*unique*combo}}', 'main', { random: () => 0 })
    if (behavior === 'error') expect(draw).toThrow(/Unique selection overflow/)
    else expect(draw().text).toBe(behavior === 'cycle' ? 'A, B, A, B, A' : 'A, B')
  })

  it.each(['items', 'merged'] as const)('traces the actual unique pool and cycle refill for %s', id => {
    const engine = new RandomTableEngine()
    engine.loadCollection(document('audit.trace', [items('items', ['A', 'B']), { id: 'merged', name: 'Merged', type: 'collection', collections: ['items'] }], 'cycle'), 'main')
    const result = engine.evaluateRawPattern(`{{1*unique*${id}}}|{{1*unique*${id}}}|{{1*unique*${id}}}`, 'main', { random: () => 0, enableTrace: true })
    expect(result.text).toBe('A|B|A')
    const draws = selections(result.trace!.root)
    expect(draws.map(draw => draw.poolSize)).toEqual([2, 1, 2])
    expect(draws.map(draw => draw.probability)).toEqual([0.5, 1, 0.5])
    expect(draws[1].excludedIds).toHaveLength(1)
    expect(draws[2].excludedIds).toEqual([])
  })

  it('evaluates collection entries in their source shared scope, preserving parent precedence and sibling isolation', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(document('audit.source', [
      { id: 'source', name: 'Source', type: 'simple', shared: { label: 'SOURCE' }, entries: [{ value: '{{$label}}', description: 'About {{$label}}', sets: { label: '{{$label}}' } }] },
      { id: 'merged', name: 'Merged', type: 'collection', collections: ['source'] },
      { id: 'parent', name: 'Parent', type: 'collection', collections: ['source'], shared: { label: 'PARENT' } },
      { id: 'sibling', name: 'Sibling', type: 'simple', shared: { label: 'SIBLING' }, entries: [{ value: '{{$label}}' }] },
    ]), 'main')
    const result = engine.roll('merged', 'main', { random: () => 0 })
    expect(result.text).toBe('SOURCE')
    expect(result.placeholders?.label).toBe('SOURCE')
    expect(result.descriptions?.[0].description).toBe('About SOURCE')
    expect(engine.evaluateRawPattern('{{parent}}|{{merged}}|{{sibling}}', 'main', { random: () => 0 }).text).toBe('PARENT|SOURCE|SIBLING')
  })
})

describe('table audit inheritance regressions', () => {
  it('replaces range with explicit weight and weight with explicit range', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(document('audit.modes', [
      { id: 'parent', name: 'Parent', type: 'simple', entries: [{ id: 'a', value: 'A', range: [1, 10] }, { id: 'b', value: 'B', weight: 2 }] },
      { id: 'child', name: 'Child', type: 'simple', extends: 'parent', entries: [{ id: 'a', weight: 0 }, { id: 'b', range: [1, 4] }] },
    ]), 'main')
    const resolved = engine.getResolvedTable('child', 'main')
    if (resolved?.type !== 'simple') throw new Error('Expected simple table')
    expect(resolved.entries).toEqual([{ id: 'a', value: 'A', weight: 0 }, { id: 'b', value: 'B', range: [1, 4] }])
    expect(engine.roll('child', 'main', { random: () => 0 }).text).toBe('B')
  })

  it('merges assets and sets by key and removes nullable inherited fields and dictionary keys', () => {
    const engine = new RandomTableEngine()
    const assets = JSON.parse('{"image":"parent.png","token":"token.png","__proto__":"keep.png"}') as Record<string, string>
    engine.loadCollection(document('audit.deletion', [
      { id: 'parent', name: 'Parent', type: 'simple', entries: [{ id: 'a', value: 'A', description: 'Remove me', assets, sets: { hp: '7', ac: '15', obsolete: 'old' } }, { id: 'b', value: 'B', assets: { image: 'b.png' }, sets: { old: 'x' } }] },
      { id: 'child', name: 'Child', type: 'simple', extends: 'parent', entries: [
        { id: 'a', description: null, assets: { image: 'child.png', token: null }, sets: { hp: '10', obsolete: null } },
        { id: 'b', assets: null, sets: null },
      ] },
    ]), 'main')
    const resolved = engine.getResolvedTable('child', 'main')
    if (resolved?.type !== 'simple') throw new Error('Expected simple table')
    expect(resolved.entries[0]).toEqual({ id: 'a', value: 'A', assets: JSON.parse('{"image":"child.png","__proto__":"keep.png"}'), sets: { hp: '10', ac: '15' } })
    expect(resolved.entries[1]).toEqual({ id: 'b', value: 'B' })
    expect(engine.roll('child', 'main', { random: () => 0 }).assets).toEqual(resolved.entries[0].assets)
  })

  it('deletes optional scalar and range/weight properties without deleting unrelated inherited selection modes', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(document('audit.deletefields', [
      { id: 'parent', name: 'Parent', type: 'simple', entries: [
        { id: 'a', value: 'A', range: [1, 4], tags: ['old'], resultType: 'old' },
        { id: 'b', value: 'B', weight: 3, description: 'Old' },
      ] },
      { id: 'child', name: 'Child', type: 'simple', extends: 'parent', entries: [
        { id: 'a', weight: null, tags: null, resultType: null },
        { id: 'b', range: null, weight: null, description: null },
      ] },
      { id: 'grandchild', name: 'Grandchild', type: 'simple', extends: 'child', entries: [{ id: 'a', range: null }] },
    ]), 'main')
    const child = engine.getResolvedTable('child', 'main')
    const grandchild = engine.getResolvedTable('grandchild', 'main')
    if (child?.type !== 'simple' || grandchild?.type !== 'simple') throw new Error('Expected simple tables')
    expect(child.entries).toEqual([{ id: 'a', value: 'A', range: [1, 4] }, { id: 'b', value: 'B' }])
    expect(grandchild.entries).toEqual([{ id: 'a', value: 'A' }, { id: 'b', value: 'B' }])
  })

  it('does not let a cached ancestor bypass the originating inheritance limit across collections', () => {
    const engine = new RandomTableEngine()
    engine.loadCollection(document('audit.chain0', [items('items', ['VALUE'])]), 'c0')
    for (let depth = 1; depth <= 6; depth++) {
      engine.loadCollection(document(`audit.chain${depth}`, [{ id: 'items', name: 'Items', type: 'simple', extends: `audit.chain${depth - 1}.items`, entries: [{ id: 'entry0' }] }]), `c${depth}`)
    }
    expect(() => engine.roll('items', 'c6')).toThrow(/Inheritance depth limit/)
    expect(engine.roll('items', 'c3').text).toBe('VALUE')
    expect(() => engine.roll('items', 'c6')).toThrow(/Inheritance depth limit/)
    expect(engine.roll('items', 'c5').text).toBe('VALUE')
  })
})

describe('dice modifier interoperability', () => {
  it('flattens explosion faces before keep-highest, then applies arithmetic', () => {
    const faces = [5 / 6, 3 / 6]
    const result = rollDice('1d6kh1!+2', { maxExplodingDice: 10 }, () => faces.shift()!)
    expect(result.rolls).toEqual([6, 4])
    expect(result.kept).toEqual([6])
    expect(result.total).toBe(8)
  })
})
