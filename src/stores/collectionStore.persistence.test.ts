import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RandomTableEngine } from '../engine/core'
import type { RandomTableDocument } from '../engine/types'
import type { PreloadedCollection } from '../data/preloaded'
import * as db from '../services/db'
import { useFavoriteStore } from './favoriteStore'
import { useUsageStore } from './usageStore'

const builtin = vi.hoisted(() => ({ collections: [] as PreloadedCollection[] }))
vi.mock('../data/preloaded', () => ({ preloadedCollections: builtin.collections }))
import { useCollectionStore } from './collectionStore'

const doc = (namespace: string, value = 'ONE'): RandomTableDocument => ({
  metadata: { name: namespace, namespace, version: '1.0.0', specVersion: '1.0' },
  tables: [{ id: 'one', name: 'One', type: 'simple', entries: [{ value }] }],
})
const reset = () => {
  useCollectionStore.setState({ engine: new RandomTableEngine(), records: new Map(), collections: new Map(), rejectedCollections: new Map(), isInitialized: false })
  useFavoriteStore.setState({ favorites: new Map(), isLoaded: false })
  useUsageStore.setState({ stats: new Map(), recentItems: [], popularItems: [], isLoaded: false })
}
beforeEach(async () => { await db.deleteDatabase(); builtin.collections.length = 0; reset() })
afterEach(async () => { await db.deleteDatabase(); builtin.collections.length = 0 })

describe('real IndexedDB collection transactions', () => {
  it.each(['save', 'import'])('relinks from latest persisted documents without overwriting another tab: %s', async (operation) => {
    const main = { ...doc('main'), imports: [{ alias: 'source', path: 'source' }] }
    await useCollectionStore.getState().saveCollection('main', main, 'user')
    const tabA = useCollectionStore.getState()
    // Independent loaded snapshot for tab B, against the same persistence layer.
    reset()
    await useCollectionStore.getState().initialize()
    await useCollectionStore.getState().saveCollection('main', doc('main', 'EDIT IN TAB B'), 'user')
    const tabB = await db.getCollection('main')
    useCollectionStore.setState({ records: tabA.records, collections: tabA.collections, engine: tabA.engine })
    if (operation === 'save') await useCollectionStore.getState().saveCollection('source', doc('source'), 'user')
    else await useCollectionStore.getState().saveImportedCollections([
      { id: 'source', name: 'source', document: doc('source'), fileName: 'source.json' },
    ], 'file')
    expect(await db.getCollection('main')).toEqual(tabB)
    expect((await db.getCollection('main'))!.resolvedImports).toEqual({})
    // Relinking did not acknowledge tab B's document revision on behalf of A.
    await expect(useCollectionStore.getState().saveCollection('main', main, 'user')).rejects.toThrow('changed in another tab')
    expect(await db.getCollection('main')).toEqual(tabB)
  })

  it('persists a new binding without changing the latest dependent body, revision, or visibility', async () => {
    const main = { ...doc('main'), imports: [{ alias: 'source', path: 'source' }] }
    await useCollectionStore.getState().saveCollection('main', main, 'user')
    const tabA = useCollectionStore.getState()
    reset(); await useCollectionStore.getState().initialize()
    const edited = { ...main, tables: doc('main', 'B').tables }
    await useCollectionStore.getState().saveCollection('main', edited, 'user')
    await useCollectionStore.getState().hideCollection('main')
    const latest = (await db.getCollection('main'))!
    useCollectionStore.setState({ records: tabA.records, collections: tabA.collections, engine: tabA.engine })
    await useCollectionStore.getState().saveCollection('source', doc('source'), 'user')
    expect(await db.getCollection('main')).toEqual({ ...latest, resolvedImports: { source: 'source' } })
  })

  it('removes favorites and usage alongside deletion and immediately exposes lower-ranked live items', async () => {
    for (let i = 0; i < 10; i++) {
      const id = `deleted-${i}`
      await useCollectionStore.getState().saveCollection(id, doc(`user.item${i}`), 'user')
      await useFavoriteStore.getState().addFavorite(id, 'one', 'table')
      await useUsageStore.getState().recordUsage(id, 'table', 'one')
      await useUsageStore.getState().recordUsage(id, 'table', 'one')
    }
    await useCollectionStore.getState().saveCollection('live', doc('live'), 'user')
    await useUsageStore.getState().recordUsage('live', 'table', 'one')
    for (let i = 0; i < 10; i++) await useCollectionStore.getState().deleteCollection(`deleted-${i}`)
    expect(await db.getAllFavorites()).toEqual([])
    expect(useFavoriteStore.getState().favorites.size).toBe(0)
    expect((await db.getAllUsageStats()).map((stat) => stat.collectionId)).toEqual(['live'])
    expect(useUsageStore.getState().popularItems.map((stat) => stat.collectionId)).toEqual(['live'])
  })

  it('does not recreate local or persisted favorite/usage rows when writes race deletion', async () => {
    await useCollectionStore.getState().saveCollection('race', doc('race'), 'user')
    await useFavoriteStore.getState().addFavorite('race', 'one', 'table')
    await useUsageStore.getState().recordUsage('race', 'table', 'one')
    // Begin deletion before UI events enqueue new metadata transactions.
    await Promise.all([
      db.deleteCollection('race'),
      useFavoriteStore.getState().addFavorite('race', 'one', 'table'),
      useUsageStore.getState().recordUsage('race', 'table', 'one'),
    ])
    expect(await db.getAllFavorites()).toEqual([])
    expect(await db.getAllUsageStats()).toEqual([])
    expect(useFavoriteStore.getState().favorites.size).toBe(0)
    expect(useUsageStore.getState().stats.size).toBe(0)
    expect(useUsageStore.getState().popularItems).toEqual([])
  })

  it('repairs invalid legacy bundled imports without blocking other collections', async () => {
    const current = { ...doc('builtin'), imports: [{ alias: 'source', path: 'source' }] }
    builtin.collections.push({ id: 'builtin', document: current }, { id: 'source', document: doc('source') })
    await db.saveCollection({ id: 'builtin', document: { ...current, imports: [null] } as unknown as RandomTableDocument,
      name: 'Old', namespace: 'builtin', version: '1.0.0', tags: [], isPreloaded: true, source: 'preloaded', createdAt: 0, updatedAt: 0 })
    await useCollectionStore.getState().initialize()
    expect(useCollectionStore.getState().isInitialized).toBe(true)
    expect((await db.getCollection('builtin'))!.resolvedImports).toEqual({ source: 'source' })
    expect(useCollectionStore.getState().engine.getCollection('source')).toBeDefined()
  })

  it('reconciles updated bundled import declarations, metadata and exports while preserving hidden preference', async () => {
    const old = { ...doc('builtin'), imports: [{ alias: 'source', path: 'old' }] }
    builtin.collections.push({ id: 'builtin', document: old }, { id: 'old', document: doc('old') }, { id: 'new', document: doc('new') })
    await useCollectionStore.getState().initialize()
    await useCollectionStore.getState().hideCollection('builtin')
    builtin.collections[0].document = { ...doc('builtin', 'UPDATED'), imports: [{ alias: 'source', path: 'new' }] }
    reset(); await useCollectionStore.getState().initialize()
    const persisted = (await db.getCollection('builtin'))!
    expect(persisted.document).toEqual(builtin.collections[0].document)
    expect(persisted.resolvedImports).toEqual({ source: 'new' })
    expect(persisted.hiddenFromUI).toBe(true)
    expect(useCollectionStore.getState().engine.getCollection('builtin')!.imports.get('source')!.id).toBe('new')
  })
})
