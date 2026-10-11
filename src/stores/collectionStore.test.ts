import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoredCollection } from '../services/db'
import type { RandomTableDocument } from '../engine/types'
import { RandomTableEngine } from '../engine/core'

const mocks = vi.hoisted(() => ({ records: new Map<string, StoredCollection>(), failSave: false, failDelete: false, delayNextSave: undefined as (() => Promise<void>) | undefined }))
vi.mock('../data/preloaded', () => ({ preloadedCollections: [] }))
vi.mock('../services/db', async (original) => {
  const actual = await original<typeof import('../services/db')>()
  return { ...actual, init: async () => undefined, cleanupOrphanedCollectionMetadata: async () => undefined,
    getAllCollections: async () => [...mocks.records.values()],
    getCollection: async (id: string) => mocks.records.get(id),
    saveCollection: async (record: StoredCollection) => {
      if (mocks.failSave) throw new Error('write failed')
      mocks.records.set(record.id, record)
    },
    saveCollections: async (records: StoredCollection[]) => {
      const delay = mocks.delayNextSave
      mocks.delayNextSave = undefined
      if (delay) await delay()
      if (mocks.failSave) throw new Error('write failed')
      records.forEach((record) => mocks.records.set(record.id, record))
    },
    updateCollections: async (update: (current: Map<string, StoredCollection>) => StoredCollection[]) => {
      const delay = mocks.delayNextSave
      mocks.delayNextSave = undefined
      if (delay) await delay()
      if (mocks.failSave) throw new Error('write failed')
      const current = new Map(mocks.records)
      const changed = update(current)
      changed.forEach((record) => mocks.records.set(record.id, record))
      return new Map(mocks.records)
    },
    setCollectionHidden: async (id: string, hiddenFromUI: boolean) => {
      const record = mocks.records.get(id)
      if (record) mocks.records.set(id, { ...record, hiddenFromUI })
    },
    restoreHiddenPreloadedCollections: async () => {
      let count = 0
      for (const [id, record] of mocks.records) {
        if (record.isPreloaded && record.hiddenFromUI) {
          mocks.records.set(id, { ...record, hiddenFromUI: false }); count++
        }
      }
      return count
    },
    deleteCollection: async (id: string) => {
      if (mocks.failDelete) throw new Error('delete failed')
      mocks.records.delete(id)
    },
  }
})
import { buildImportBindings, useCollectionStore } from './collectionStore'

const doc = (namespace: string, value = 'SOURCE'): RandomTableDocument => ({
  metadata: { name: namespace, namespace, version: '1.0.0', specVersion: '1.0' },
  tables: [{ id: 'one', name: 'One', type: 'simple', entries: [{ value }] }],
})
const incoming = (id: string, document: RandomTableDocument, originalPath: string, bundleId = 'bundle') => ({
  id, document, name: id, fileName: originalPath.split('/').pop()!, originalPath, bundleId,
})
const reset = () => useCollectionStore.setState({ engine: new RandomTableEngine(), collections: new Map(), records: new Map(), rejectedCollections: new Map(), isInitialized: false })

beforeEach(() => { mocks.records.clear(); mocks.failSave = false; mocks.failDelete = false; mocks.delayNextSave = undefined; reset() })

describe('durable collection state', () => {
  it('preserves archive origins and exact filename imports across edits and refresh', async () => {
    const main = doc('main')
    main.imports = [{ alias: 'source', path: '../tables/source.json' }]
    await useCollectionStore.getState().saveImportedCollections([
      incoming('main', main, 'generators/main.json'), incoming('source', doc('source'), 'tables/source.json'),
    ], 'zip')
    expect(useCollectionStore.getState().engine.evaluateRawPattern('{{source.one}}', 'main').text).toBe('SOURCE')
    const edited = { ...main, metadata: { ...main.metadata, name: 'Edited' } }
    await useCollectionStore.getState().saveCollection('main', edited, 'user')
    expect(mocks.records.get('main')).toMatchObject({ originalPath: 'generators/main.json', bundleId: 'bundle', resolvedImports: { source: 'source' } })
    reset()
    await useCollectionStore.getState().initialize()
    expect(useCollectionStore.getState().engine.evaluateRawPattern('{{source.one}}', 'main').text).toBe('SOURCE')
  })

  it('scopes identical archive filenames to distinct bundles', async () => {
    const main = doc('main'); main.imports = [{ alias: 'source', path: './source.json' }]
    await useCollectionStore.getState().saveImportedCollections([
      incoming('mainA', main, 'main.json', 'A'), incoming('sourceA', doc('source', 'A'), 'source.json', 'A'),
      incoming('mainB', main, 'main.json', 'B'), incoming('sourceB', doc('source', 'B'), 'source.json', 'B'),
    ], 'zip')
    const bindings = buildImportBindings(useCollectionStore.getState().records)
    expect(bindings.get('mainA')?.get('source')).toBe('sourceA')
    expect(bindings.get('mainB')?.get('source')).toBe('sourceB')
  })

  it('persists newly resolved namespaces by exact identity and never rebinds deleted versions', async () => {
    const main = doc('main'); main.imports = [{ alias: 'source', path: 'source' }]
    await useCollectionStore.getState().saveCollection('main', main, 'user')
    await useCollectionStore.getState().saveCollection('sourceFirst', doc('source', 'FIRST'), 'user')
    expect(mocks.records.get('main')!.resolvedImports).toEqual({ source: 'sourceFirst' })
    await useCollectionStore.getState().saveCollection('sourceSecond', doc('source', 'SECOND'), 'user')
    reset()
    await useCollectionStore.getState().initialize()
    expect(useCollectionStore.getState().engine.evaluateRawPattern('{{source.one}}', 'main').text).toBe('FIRST')
    await useCollectionStore.getState().deleteCollection('sourceFirst')
    expect(useCollectionStore.getState().engine.getCollection('main')!.imports.has('source')).toBe(false)
    expect(mocks.records.get('main')!.resolvedImports).toEqual({ source: 'sourceFirst' })
  })

  it('retains originals and engine state after failed save or delete', async () => {
    await useCollectionStore.getState().saveCollection('original', doc('original'), 'user')
    mocks.failSave = true
    await expect(useCollectionStore.getState().saveCollection('original', doc('original', 'EDIT'), 'user')).rejects.toThrow('write failed')
    expect(useCollectionStore.getState().getCollectionDocument('original')!.tables[0]).toMatchObject({ entries: [{ value: 'SOURCE' }] })
    mocks.failDelete = true
    await expect(useCollectionStore.getState().deleteCollection('original')).rejects.toThrow('delete failed')
    expect(useCollectionStore.getState().engine.getCollection('original')).toBeDefined()
  })

  it('allocates duplicate identities inside the queue and rejects malformed saves', async () => {
    const saved = await useCollectionStore.getState().saveImportedCollections([
      incoming('same', doc('a'), 'a.json'), incoming('same', doc('b'), 'b.json'),
    ], 'zip')
    expect(saved.map((collection) => collection.id)).toEqual(['same', 'same-2'])
    await expect(useCollectionStore.getState().saveCollection('bad', {} as RandomTableDocument, 'user')).rejects.toThrow()
    expect(mocks.records.size).toBe(2)
  })

  it('reserves final IDs for overlapping import batches after delayed persistence', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    mocks.delayNextSave = () => pending
    const first = useCollectionStore.getState().saveImportedCollections([incoming('same', doc('same', 'FIRST'), 'one.json', 'first')], 'file')
    const second = useCollectionStore.getState().saveImportedCollections([incoming('same', doc('same', 'SECOND'), 'one.json', 'second')], 'file')
    release()
    const saved = await Promise.all([first, second])
    expect(saved.map((batch) => batch[0].id)).toEqual(['same', 'same-2'])
    expect(useCollectionStore.getState().engine.evaluateRawPattern('{{one}}', 'same').text).toBe('FIRST')
    expect(useCollectionStore.getState().engine.evaluateRawPattern('{{one}}', 'same-2').text).toBe('SECOND')
  })

  it('preserves hidden preferences through dependency relinking and reload', async () => {
    const main = doc('main'); main.imports = [{ alias: 'source', path: 'source' }]
    await useCollectionStore.getState().saveCollection('main', main, 'user')
    await useCollectionStore.getState().hideCollection('main')
    await useCollectionStore.getState().saveCollection('source', doc('source'), 'user')
    expect(mocks.records.get('main')!.hiddenFromUI).toBe(true)
    reset(); await useCollectionStore.getState().initialize()
    expect(useCollectionStore.getState().collections.get('main')!.hiddenFromUI).toBe(true)
    expect(useCollectionStore.getState().records.get('main')!.hiddenFromUI).toBe(true)
  })

  it('keeps restored preload visibility in records when dependency bindings later change', async () => {
    const main = doc('main'); main.imports = [{ alias: 'source', path: 'source' }]
    await useCollectionStore.getState().saveCollection('main', main, 'user')
    const record = { ...mocks.records.get('main')!, isPreloaded: true }
    mocks.records.set('main', record)
    const state = useCollectionStore.getState()
    state.records.set('main', record)
    state.collections.set('main', { ...state.collections.get('main')!, isPreloaded: true })
    await useCollectionStore.getState().hideCollection('main')
    await useCollectionStore.getState().restoreHiddenCollections()
    expect(useCollectionStore.getState().records.get('main')!.hiddenFromUI).toBe(false)
    await useCollectionStore.getState().saveCollection('source', doc('source'), 'user')
    expect(mocks.records.get('main')!.hiddenFromUI).toBe(false)
  })

  it('keeps rejected legacy documents recoverable while loading subsequent valid records', async () => {
    const metadata = { name: 'Legacy', namespace: 'legacy', version: '1.0.0', tags: [], isPreloaded: false,
      source: 'user' as const, createdAt: 0, updatedAt: 0 }
    mocks.records.set('broken', { ...metadata, id: 'broken', document: {} as RandomTableDocument })
    mocks.records.set('valid', { ...metadata, id: 'valid', document: doc('valid') })
    await useCollectionStore.getState().initialize()
    expect(useCollectionStore.getState().isInitialized).toBe(true)
    expect(useCollectionStore.getState().engine.getCollection('valid')).toBeDefined()
    expect(useCollectionStore.getState().getRejectedCollections()[0].record.document).toEqual({})
    expect(mocks.records.get('broken')!.document).toEqual({})
    await useCollectionStore.getState().saveCollection('broken', doc('repaired'), 'user')
    expect(useCollectionStore.getState().rejectedCollections.size).toBe(0)
  })

  it('applies same-ID mutations in invocation order and keeps other collections', async () => {
    await Promise.all([
      useCollectionStore.getState().saveCollection('same', doc('same', 'FIRST'), 'user'),
      useCollectionStore.getState().saveCollection('other', doc('other'), 'user'),
      useCollectionStore.getState().saveCollection('same', doc('same', 'SECOND'), 'user'),
    ])
    expect(useCollectionStore.getState().collections.size).toBe(2)
    expect(useCollectionStore.getState().engine.evaluateRawPattern('{{one}}', 'same').text).toBe('SECOND')
  })
})
