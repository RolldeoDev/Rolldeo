import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RandomTableEngine } from '../engine/core'
import type { StoredRoll } from '../services/db'
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

const persistence = vi.hoisted(() => ({
  rows: [] as StoredRoll[], limit: 2, nextId: 1,
  blockSave: undefined as undefined | Promise<void>,
}))
vi.mock('../services/db', () => ({
  getPreferences: vi.fn(async () => ({ historyLimit: persistence.limit })),
  saveRoll: vi.fn(async (roll: StoredRoll) => {
    if (persistence.blockSave) await persistence.blockSave
    const id = persistence.nextId++
    persistence.rows.unshift({ ...roll, id })
    return id
  }),
  trimHistory: vi.fn(async (limit: number) => {
    let unpinned = 0
    persistence.rows = persistence.rows.filter(row => row.pinned || ++unpinned <= limit)
  }),
  getRetainedRollHistory: vi.fn(async () => persistence.rows.map(row => ({ ...row }))),
  pinRoll: vi.fn(async (id: number, pinned: boolean) => {
    persistence.rows = persistence.rows.map(row => row.id === id ? { ...row, pinned } : row)
  }),
  deleteRoll: vi.fn(async (id: number) => { persistence.rows = persistence.rows.filter(row => row.id !== id) }),
  clearHistory: vi.fn(async (keepPinned: boolean) => { persistence.rows = keepPinned ? persistence.rows.filter(row => row.pinned) : [] }),
}))
vi.mock('./usageStore', () => ({ useUsageStore: { getState: () => ({ recordUsage: vi.fn() }) } }))

beforeEach(() => {
  persistence.rows = []
  persistence.nextId = 1
  persistence.limit = 2
  persistence.blockSave = undefined
  const engine = new RandomTableEngine()
  engine.loadCollection({
    metadata: { name: 'Test', namespace: 'test.store', version: '1.0.0', specVersion: '1.0' },
    tables: [
      { id: 'a', name: 'Alpha', type: 'simple', entries: [{ value: 'same text' }] },
      { id: 'b', name: 'Beta', type: 'simple', entries: [{ value: 'same text' }] },
    ],
    templates: [{ id: 'template', name: 'Template', pattern: 'template text' }],
  }, 'collection')
  useCollectionStore.setState({ engine })
  useRollStore.setState({ selectedCollectionId: null, selectedTableId: null, selectedTemplateId: null,
    currentResult: null, currentRoll: null, currentItemName: null, history: [], historyLoaded: false,
    historyError: null, isRolling: false, rollError: null })
})

describe('roll history and result provenance', () => {
  it('preserves a newer result requested after a queued clear', async () => {
    let unblock!: () => void
    persistence.blockSave = new Promise<void>(resolve => { unblock = resolve })
    const store = useRollStore.getState()
    const first = store.rollOnTable('collection', 'a')
    const clear = store.clearHistory()
    const second = store.rollOnTemplate('collection', 'template')
    unblock()
    await Promise.all([first, clear, second])
    expect(useRollStore.getState().currentResult?.text).toBe('template text')
    expect(useRollStore.getState().currentRoll?.templateId).toBe('template')
    expect(useRollStore.getState().history).toHaveLength(1)
  })

  it('retains the source and exact identity of identical-text results after selection changes', async () => {
    const store = useRollStore.getState()
    await store.rollOnTable('collection', 'a')
    const firstId = useRollStore.getState().currentRoll?.id
    store.selectCollection('collection')
    store.selectTable('b')
    expect(useRollStore.getState().currentRoll).toMatchObject({ id: firstId, tableId: 'a' })
    expect(useRollStore.getState().currentItemName).toBe('Alpha')
    // The card uses this source to re-roll, regardless of selected B.
    const source = useRollStore.getState().currentRoll!
    await store.rollOnTable(source.collectionId, source.tableId!)
    expect(useRollStore.getState().currentRoll?.tableId).toBe('a')
    expect(useRollStore.getState().currentRoll?.id).not.toBe(firstId)
  })

  it('keeps pinned rolls through configured retention and a reload, and honors limit zero', async () => {
    const store = useRollStore.getState()
    await store.rollOnTable('collection', 'a')
    await store.pinResult(useRollStore.getState().currentRoll!.id!, true)
    for (let i = 0; i < 4; i++) await store.rollOnTable('collection', 'b')
    expect(useRollStore.getState().history).toHaveLength(3)
    expect(useRollStore.getState().history.filter(row => row.pinned)).toHaveLength(1)
    useRollStore.setState({ history: [], historyLoaded: false })
    await store.loadHistory()
    expect(useRollStore.getState().history).toHaveLength(3)
    persistence.limit = 0
    await store.rollOnTable('collection', 'b')
    expect(useRollStore.getState().history).toHaveLength(1)
    expect(useRollStore.getState().history[0].pinned).toBe(true)
  })

  it('does not let a delayed earlier save replace the newer result or mislabel it', async () => {
    let unblock!: () => void
    persistence.blockSave = new Promise<void>(resolve => { unblock = resolve })
    const store = useRollStore.getState()
    const first = store.rollOnTable('collection', 'a')
    const second = store.rollOnTemplate('collection', 'template')
    expect(useRollStore.getState().currentItemName).toBe('Template')
    expect(useRollStore.getState().isRolling).toBe(true)
    unblock()
    await Promise.all([first, second])
    expect(useRollStore.getState().currentRoll).toMatchObject({ id: 2, templateId: 'template' })
    expect(useRollStore.getState().currentResult?.text).toBe('template text')
    expect(useRollStore.getState().isRolling).toBe(false)
  })

  it('serializes clear after a pending save and clears the current deleted record', async () => {
    let unblock!: () => void
    persistence.blockSave = new Promise<void>(resolve => { unblock = resolve })
    const store = useRollStore.getState()
    const roll = store.rollOnTable('collection', 'a')
    const clear = store.clearHistory()
    unblock()
    await Promise.all([roll, clear])
    expect(useRollStore.getState().history).toEqual([])
    expect(useRollStore.getState().currentRoll).toBeNull()
    persistence.blockSave = undefined
    await store.rollOnTable('collection', 'b')
    await store.deleteHistoryItem(useRollStore.getState().currentRoll!.id!)
    expect(useRollStore.getState().currentResult).toBeNull()
  })
})
