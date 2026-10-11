import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RandomTableEngine } from '../engine/core'
import { useCollectionStore } from './collectionStore'
import { useRollStore } from './rollStore'

vi.hoisted(() => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  } })
})
vi.mock('../services/db', () => ({
  saveRoll: vi.fn(async () => 1),
  getPreferences: vi.fn(async () => ({ historyLimit: 100 })),
  trimHistory: vi.fn(async () => {}),
  getRetainedRollHistory: vi.fn(async () => []),
}))
vi.mock('./usageStore', () => ({ useUsageStore: { getState: () => ({ recordUsage: vi.fn() }) } }))

beforeEach(() => {
  const engine = new RandomTableEngine()
  for (const id of ['one', 'two']) engine.loadCollection({
    metadata: { name: id, namespace: `test.${id}`, specVersion: '1.1', version: '1.0.0' },
    inputs: { level: { type: 'integer', required: true, min: 1, max: 20 }, terrain: { type: 'choice', options: ['forest', 'desert'], default: 'forest' } },
    tables: [{ id: 'table', name: 'Table', type: 'simple', entries: [{ value: '{{$terrain}} {{$level}}' }] }],
    templates: [{ id: 'template', name: 'Template', pattern: '{{$level}}' }],
  }, id)
  useCollectionStore.setState({ engine })
  useRollStore.setState({ selectedCollectionId: null, selectedTableId: null, selectedTemplateId: null, inputValues: {}, currentResult: null, currentRoll: null, history: [], rollError: null, isRolling: false })
})

describe('roller input context', () => {
  it('passes context through selected, direct table and template rolls', async () => {
    const store = useRollStore.getState()
    store.selectCollection('one')
    store.selectTable('table')
    store.setInputValue('level', 4)
    store.setInputValue('terrain', 'desert')
    expect((await store.roll())?.text).toBe('desert 4')
    expect((await store.rollOnTable('one', 'table')).metadata.inputs).toEqual({ level: 4, terrain: 'desert' })
    expect((await store.rollOnTemplate('one', 'template')).text).toBe('4')
  })

  it('retains the last success and exposes errors for invalid or absent values', async () => {
    const store = useRollStore.getState()
    store.selectCollection('one')
    store.setInputValue('level', 3)
    const success = await store.rollOnTable('one', 'table')
    store.setInputValue('level', 25)
    expect(store.getInputErrors('one')).toEqual({ level: 'Enter 20 or less.' })
    await expect(store.rollOnTable('one', 'table')).rejects.toThrow('INPUT_ERROR')
    expect(useRollStore.getState().currentResult).toBe(success)
    expect(useRollStore.getState().rollError).toContain('level')
    store.setInputValue('level', undefined)
    expect(store.getInputErrors('one').level).toBe('This input is required.')
  })

  it('prunes removed declarations on a same-ID live edit without requiring a selection change', async () => {
    const store = useRollStore.getState()
    store.selectCollection('one')
    store.setInputValue('level', 7)
    store.setInputValue('terrain', 'forest')
    const collectionStore = useCollectionStore.getState()
    const previousDocument = collectionStore.engine.getCollection('one')!.document
    const nextDocument = { ...previousDocument, inputs: undefined, tables: [{ id: 'table', name: 'Table', type: 'simple' as const, entries: [{ value: 'Still usable' }] }] }
    const mapBefore = collectionStore.collections
    collectionStore.updateCollectionDocument('one', nextDocument)
    expect(useCollectionStore.getState().collections).not.toBe(mapBefore)
    expect(useRollStore.getState().selectedCollectionId).toBe('one')
    expect(useRollStore.getState().inputValues).toEqual({})
    expect(store.getInputErrors('one')).toEqual({})
    expect((await store.rollOnTable('one', 'table')).text).toBe('Still usable')
    expect(() => collectionStore.engine.roll('table', 'one', { inputs: { terrain: 'forest' } })).toThrow('Unknown input')
  })

  it('prunes a renamed input on same-ID re-import, keeps surviving context and asks for the new name', () => {
    const store = useRollStore.getState()
    store.selectCollection('one')
    store.setInputValue('level', 7)
    store.setInputValue('terrain', 'forest')
    const collectionStore = useCollectionStore.getState()
    const previousDocument = collectionStore.engine.getCollection('one')!.document
    collectionStore.loadCollection('one', { ...previousDocument, inputs: { level: { type: 'integer', required: true, min: 1, max: 20 }, biome: { type: 'text', required: true } } })
    expect(useRollStore.getState().inputValues).toEqual({ level: 7 })
    expect(store.getInputErrors('one')).toEqual({ biome: 'This input is required.' })
    store.setInputValue('biome', 'forest')
    expect(store.getInputErrors('one')).toEqual({})
  })

  it('reconciles same-ID selection after direct engine replacement and preserves atomicity on invalid edits', () => {
    const store = useRollStore.getState()
    store.selectCollection('one')
    store.setInputValue('level', 7)
    store.setInputValue('terrain', 'forest')
    const collectionStore = useCollectionStore.getState()
    const previousDocument = collectionStore.engine.getCollection('one')!.document
    const collectionsBefore = collectionStore.collections
    expect(() => collectionStore.updateCollectionDocument('one', { ...previousDocument, inputs: { level: { type: 'integer', min: 20, max: 1 } } })).toThrow()
    expect(useCollectionStore.getState().collections).toBe(collectionsBefore)
    expect(useRollStore.getState().inputValues).toEqual({ level: 7, terrain: 'forest' })
    collectionStore.engine.updateDocument('one', { ...previousDocument, inputs: undefined })
    store.selectCollection('one')
    expect(useRollStore.getState().inputValues).toEqual({})
  })

  it('resets values when collections change and does not forward context to direct rolls elsewhere', async () => {
    const store = useRollStore.getState()
    store.selectCollection('one')
    store.setInputValue('level', 5)
    store.selectCollection('one')
    expect(useRollStore.getState().inputValues).toEqual({ level: 5 })
    await expect(store.rollOnTemplate('two', 'template')).rejects.toThrow('level')
    store.selectCollection('two')
    expect(useRollStore.getState().inputValues).toEqual({})
    expect(store.getInputErrors('two').level).toBe('This input is required.')
    store.setInputValue('level', 8)
    expect(useRollStore.getState().rollError).toBeNull()
    expect((await store.rollOnTemplate('two', 'template')).text).toBe('8')
  })
})
