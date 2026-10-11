// Every test uses a new in-process IndexedDB implementation; no browser profile is touched.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as db from './db'
import { RandomTableEngine } from '../engine/core'
import type { StoredCollection } from './db'
import type { RandomTableDocument } from '../engine/types'

const document: RandomTableDocument = {
  metadata: { name: 'Test', namespace: 'test', version: '1.0.0', specVersion: '1.0' },
  tables: [{ id: 'one', name: 'One', type: 'simple', entries: [{ value: 'ONE' }] }],
}
const engine = new RandomTableEngine()
engine.loadCollection(document, 'test')
const result = engine.roll('one', 'test')

const seed = async (id = 'test') => db.saveCollection({ id, document, name: 'Test', namespace: 'test', version: '1.0.0',
  tags: [], isPreloaded: false, source: 'user', createdAt: 0, updatedAt: 0 })

beforeEach(async () => { await db.deleteDatabase() })
afterEach(async () => { await db.deleteDatabase() })

describe('IndexedDB durability and retention', () => {
  it('prunes unpinned records beyond the former 10,000 query cap and retains every pin', async () => {
    const database = await db.init()
    const tx = database.transaction('rollHistory', 'readwrite')
    const writes = []
    for (let timestamp = 0; timestamp < 10005; timestamp++) {
      writes.push(tx.store.add({ result, collectionId: 'test', pinned: timestamp >= 5, timestamp }))
    }
    await Promise.all(writes)
    await tx.done
    await db.trimHistory(3)
    const retained = await db.getRetainedRollHistory(3)
    expect(retained).toHaveLength(10003)
    expect(retained.filter((roll) => !roll.pinned).map((roll) => roll.timestamp)).toEqual([4, 3, 2])
    expect(await db.getPinnedRolls()).toHaveLength(10000)
    expect(await database.count('rollHistory')).toBe(10003)
    await db.trimHistory(0)
    expect(await database.count('rollHistory')).toBe(10000)
  })

  it('counts concurrent usage atomically', async () => {
    await seed()
    await Promise.all(Array.from({ length: 25 }, () => db.recordUsage('test', 'table', 'one')))
    expect((await db.getUsageStats('test', 'table', 'one'))!.rollCount).toBe(25)
  })

  it('returns persisted favorite identity and order even when added concurrently', async () => {
    await seed()
    const favorites = await Promise.all([
      db.addFavorite('test', 'table', 'one'), db.addFavorite('test', 'table', 'two'), db.addFavorite('test', 'table', 'one'),
    ])
    expect(favorites[0]).toEqual(favorites[2])
    expect(new Set((await db.getAllFavorites()).map((item) => item.sortOrder)).size).toBe(2)
  })

  it('aborts an entire batch when a write fails and preserves earlier records', async () => {
    const original: StoredCollection = { id: 'original', document, name: 'Original', namespace: 'test', version: '1.0.0',
      tags: [], isPreloaded: false, source: 'user', createdAt: 0, updatedAt: 0 }
    await db.saveCollection(original)
    const uncloneable = { ...original, id: 'bad', document: { ...document, impossible: () => undefined } } as StoredCollection
    await expect(db.saveCollections([{ ...original, name: 'Changed' }, uncloneable])).rejects.toThrow()
    expect((await db.getCollection('original'))!.name).toBe('Original')
    expect(await db.getCollection('bad')).toBeUndefined()
  })
})

it('upgrades the actual version-1 stores without losing documents, preferences, or history', async () => {
  const { openDB } = await import('idb')
  const legacy = await openDB('rolldeo-db', 1, { upgrade(database) {
    const collections = database.createObjectStore('collections', { keyPath: 'id' })
    collections.createIndex('by-namespace', 'namespace')
    collections.createIndex('by-preloaded', 'isPreloaded')
    collections.createIndex('by-tags', 'tags', { multiEntry: true })
    const history = database.createObjectStore('rollHistory', { keyPath: 'id', autoIncrement: true })
    history.createIndex('by-collection', 'collectionId')
    history.createIndex('by-timestamp', 'timestamp')
    history.createIndex('by-pinned', 'pinned')
    database.createObjectStore('userPreferences', { keyPath: 'id' })
  } })
  const stored: StoredCollection = { id: 'legacy', document, name: 'Legacy', namespace: 'test', version: '1.0.0',
    tags: [], isPreloaded: false, source: 'user', createdAt: 1, updatedAt: 1 }
  await legacy.put('collections', stored)
  await legacy.put('userPreferences', { id: 'preferences', theme: 'dark', historyLimit: 50 })
  await legacy.add('rollHistory', { result, collectionId: 'legacy', pinned: true, timestamp: 1 })
  legacy.close()
  const upgraded = await db.init()
  expect(upgraded.version).toBe(2)
  expect(await db.getCollection('legacy')).toEqual(stored)
  expect(await db.getPreferences()).toMatchObject({ theme: 'dark', historyLimit: 50 })
  expect(await db.getPinnedRolls()).toHaveLength(1)
  await db.addFavorite('legacy', 'table', 'one')
  await db.recordUsage('legacy', 'table', 'one')
  expect(await db.getAllFavorites()).toHaveLength(1)
  expect((await db.getAllUsageStats())[0].rollCount).toBe(1)
})


it.each(['delete-first', 'metadata-first'])('serializes deletion with concurrent favorite and usage writes: %s', async (order) => {
  await seed('race')
  const writeMetadata = () => [db.addFavorite('race', 'table', 'one'), db.recordUsage('race', 'table', 'one')]
  if (order === 'delete-first') await Promise.all([db.deleteCollection('race'), ...writeMetadata()])
  else await Promise.all([...writeMetadata(), db.deleteCollection('race')])
  expect(await db.collectionExists('race')).toBe(false)
  expect(await db.getAllFavorites()).toEqual([])
  expect(await db.getAllUsageStats()).toEqual([])
})
