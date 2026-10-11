import { describe, expect, it } from 'vitest'
import { RandomTableEngine } from '../engine/core'
import type { RandomTableDocument, Table } from '../engine/types'
import { computeTableVisualization } from './useTableVisualization'

function engineWith(tables: Table[]) {
  const engine = new RandomTableEngine()
  const document: RandomTableDocument = {
    metadata: { name: 'Visualization', namespace: 'test.visualization', version: '1.0.0', specVersion: '1.0' }, tables,
  }
  engine.loadCollection(document, 'collection')
  return engine
}

describe('effective table visualizations', () => {
  it('uses inclusive range weights instead of counting entries equally', () => {
    const engine = engineWith([{ id: 'ranges', name: 'Ranges', type: 'simple', entries: [
      { id: 'common', value: 'Common', range: [1, 9] }, { id: 'rare', value: 'Rare', range: [10, 10] },
    ] }])
    const chart = computeTableVisualization(engine, 'collection', 'ranges')
    expect(chart?.type).toBe('simple')
    if (chart?.type !== 'simple') throw new Error('Expected simple chart')
    expect(chart.entries[0].probability).toBeCloseTo(90)
    expect(chart.entries[1].probability).toBeCloseTo(10)
    expect(chart.stats.totalWeight).toBe(10)
  })

  it('uses inherited entries, child overrides, and reload revisions', () => {
    const engine = engineWith([
      { id: 'parent', name: 'Parent', type: 'simple', entries: [{ id: 'one', value: 'One', weight: 9 }, { id: 'two', value: 'Two' }] },
      { id: 'child', name: 'Child', type: 'simple', extends: 'parent', entries: [{ id: 'two', value: 'Changed', weight: 9 }] },
    ])
    const chart = computeTableVisualization(engine, 'collection', 'child')
    if (chart?.type !== 'simple') throw new Error('Expected simple chart')
    expect(chart.totalEntries).toBe(2)
    expect(chart.entries.map(entry => entry.probability)).toEqual([50, 50])
    expect(chart.inheritance.map(node => node.tableId)).toEqual(['child', 'parent'])
    engine.loadCollection({ metadata: { name: 'Updated', namespace: 'test.visualization', version: '1.0.0', specVersion: '1.0' },
      tables: [{ id: 'child', name: 'Child', type: 'simple', entries: [{ value: 'New' }] }] }, 'collection')
    const updated = computeTableVisualization(engine, 'collection', 'child')
    if (updated?.type !== 'simple') throw new Error('Expected simple chart')
    expect(updated.entries[0].label).toBe('New')
    expect(updated.entries[0].probability).toBe(100)
  })

  it('computes collection contribution from effective weights and excludes zero entries', () => {
    const engine = engineWith([
      { id: 'a', name: 'A', type: 'simple', entries: [{ value: 'Heavy', range: [1, 9] }, { value: 'Never', weight: 0 }] },
      { id: 'b', name: 'B', type: 'simple', entries: [{ value: 'Light' }] },
      { id: 'merged', name: 'Merged', type: 'collection', collections: ['a', 'b'] },
    ])
    const chart = computeTableVisualization(engine, 'collection', 'merged')
    if (chart?.type !== 'collection') throw new Error('Expected collection chart')
    expect(chart.sources[0].contributionPercent).toBeCloseTo(90)
    expect(chart.sources[1].contributionPercent).toBeCloseTo(10)
    expect(chart.totalEntries).toBe(2)
    expect(chart.stats.totalWeight).toBe(10)
  })

  it('counts resolved source outcomes once when collection aliases refer to the same table', () => {
    const engine = engineWith([])
    engine.loadCollection({ metadata: { name: 'Sources', namespace: 'test.sources', version: '1.0.0', specVersion: '1.0' },
      tables: [{ id: 'items', name: 'Items', type: 'simple', entries: [{ value: 'A' }, { value: 'B' }] }] }, 'sources')
    engine.updateDocument('collection', { metadata: { name: 'Visualization', namespace: 'test.visualization', version: '1.0.0', specVersion: '1.0' },
      imports: [{ alias: 'source', path: 'test.sources' }], tables: [{ id: 'merged', name: 'Merged', type: 'collection', collections: ['source.items', 'test.sources.items'] }] })
    const chart = computeTableVisualization(engine, 'collection', 'merged')
    if (chart?.type !== 'collection') throw new Error('Expected collection chart')
    expect(chart.totalEntries).toBe(2)
    expect(chart.stats.entryCount).toBe(2)
    expect(chart.sources).toHaveLength(1)
    expect(chart.sources[0].entryCount).toBe(2)
    expect(chart.sources[0].contributionPercent).toBe(100)
  })

  it('uses composite source weights and keeps finite probabilities for huge weights', () => {
    const engine = engineWith([
      { id: 'a', name: 'A', type: 'simple', entries: [{ value: 'A' }] },
      { id: 'b', name: 'B', type: 'simple', entries: [{ value: 'B' }] },
      { id: 'combined', name: 'Combined', type: 'composite', sources: [{ tableId: 'a', weight: 1e308 }, { tableId: 'b', weight: 1e308 }] },
    ])
    const chart = computeTableVisualization(engine, 'collection', 'combined')
    if (chart?.type !== 'composite') throw new Error('Expected composite chart')
    expect(chart.sources.map(source => source.probability)).toEqual([50, 50])
    expect(chart.stats.avgWeight).toBe(1e308)
    expect(chart.stats.totalWeight).toBe(Number.MAX_VALUE)
    expect(Number.isFinite(chart.stats.totalWeight)).toBe(true)
  })
})
