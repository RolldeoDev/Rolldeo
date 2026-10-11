/**
 * IndexedDB Service
 *
 * Handles all persistence for collections, roll history, and user preferences.
 * Uses the `idb` library for type-safe IndexedDB access.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AuthoredRandomTableDocument, RollResult } from '../engine/types'

// ============================================================================
// Database Types
// ============================================================================

export interface StoredCollection {
  /** Primary key */
  id: string
  /** The raw JSON document for re-loading into engine */
  document: AuthoredRandomTableDocument
  /** Collection name for display */
  name: string
  /** Namespace from metadata */
  namespace: string
  /** Version from metadata */
  version: string
  /** Description from metadata */
  description?: string
  /** Tags for filtering */
  tags: string[]
  /** Whether this is a pre-loaded collection */
  isPreloaded: boolean
  /** Source of the collection */
  source: 'preloaded' | 'file' | 'zip' | 'user'
  /** Original filename if imported */
  fileName?: string
  originalPath?: string
  bundleId?: string
  /** Alias bindings identify exact imported collection versions. */
  resolvedImports?: Record<string, string>
  /** If true, hidden from Library and Browser panels */
  hiddenFromUI?: boolean
  /** Creation timestamp */
  createdAt: number
  /** Last update timestamp */
  updatedAt: number
  /** Document revision; metadata-only changes do not advance it. Legacy records start at zero. */
  revision?: number
}

export interface StoredRoll {
  /** Auto-increment primary key */
  id?: number
  /** The roll result */
  result: RollResult
  /** Collection this roll came from */
  collectionId: string
  /** Table ID if rolled on a table */
  tableId?: string
  /** Template ID if rolled on a template */
  templateId?: string
  /** Whether this roll is pinned */
  pinned: boolean
  /** Roll timestamp */
  timestamp: number
}

export interface UserPreferences {
  /** Primary key - always 'preferences' */
  id: 'preferences'
  /** Last selected collection */
  lastCollectionId?: string
  /** Last selected table */
  lastTableId?: string
  /** Theme preference */
  theme: 'light' | 'dark' | 'system'
  /** Maximum history entries to keep */
  historyLimit: number
}

export interface StoredFavorite {
  /** Composite key: `${collectionId}:${type}:${itemId}` */
  id: string
  /** Collection this favorite belongs to */
  collectionId: string
  /** Table or template ID */
  itemId: string
  /** Type of item */
  type: 'table' | 'template'
  /** When favorited */
  createdAt: number
  /** Display order for manual reordering */
  sortOrder: number
}

export interface UsageStats {
  /** Composite key: `${collectionId}:${type}:${itemId}` */
  id: string
  /** Collection this item belongs to */
  collectionId: string
  /** Table or template ID */
  itemId: string
  /** Type of item */
  type: 'table' | 'template'
  /** Total roll count */
  rollCount: number
  /** Last rolled timestamp */
  lastRolled: number
  /** First rolled timestamp */
  firstRolled: number
}

// ============================================================================
// Database Schema
// ============================================================================

interface RolldeooDB extends DBSchema {
  collections: {
    key: string
    value: StoredCollection
    indexes: {
      'by-namespace': string
      'by-preloaded': number // Using 1/0 for boolean index
      'by-tags': string
    }
  }
  rollHistory: {
    key: number
    value: StoredRoll
    indexes: {
      'by-collection': string
      'by-timestamp': number
      'by-pinned': number
    }
  }
  userPreferences: {
    key: string
    value: UserPreferences
  }
  favorites: {
    key: string
    value: StoredFavorite
    indexes: {
      'by-collection': string
      'by-created': number
    }
  }
  usageStats: {
    key: string
    value: UsageStats
    indexes: {
      'by-rollCount': number
      'by-lastRolled': number
    }
  }
}

const DB_NAME = 'rolldeo-db'
const DB_VERSION = 2

// ============================================================================
// Database Initialization
// ============================================================================

let dbPromise: Promise<IDBPDatabase<RolldeooDB>> | null = null

/**
 * Initialize and open the database.
 * Creates object stores on first run or version upgrade.
 */
export async function init(): Promise<IDBPDatabase<RolldeooDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RolldeooDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Collections store
        if (!db.objectStoreNames.contains('collections')) {
          const collectionStore = db.createObjectStore('collections', { keyPath: 'id' })
          collectionStore.createIndex('by-namespace', 'namespace')
          collectionStore.createIndex('by-preloaded', 'isPreloaded')
          collectionStore.createIndex('by-tags', 'tags', { multiEntry: true })
        }

        // Roll history store
        if (!db.objectStoreNames.contains('rollHistory')) {
          const historyStore = db.createObjectStore('rollHistory', {
            keyPath: 'id',
            autoIncrement: true,
          })
          historyStore.createIndex('by-collection', 'collectionId')
          historyStore.createIndex('by-timestamp', 'timestamp')
          historyStore.createIndex('by-pinned', 'pinned')
        }

        // User preferences store
        if (!db.objectStoreNames.contains('userPreferences')) {
          db.createObjectStore('userPreferences', { keyPath: 'id' })
        }

        // Version 2: Add favorites and usage stats stores
        if (oldVersion < 2) {
          // Favorites store
          if (!db.objectStoreNames.contains('favorites')) {
            const favoritesStore = db.createObjectStore('favorites', { keyPath: 'id' })
            favoritesStore.createIndex('by-collection', 'collectionId')
            favoritesStore.createIndex('by-created', 'createdAt')
          }

          // Usage stats store
          if (!db.objectStoreNames.contains('usageStats')) {
            const usageStore = db.createObjectStore('usageStats', { keyPath: 'id' })
            usageStore.createIndex('by-rollCount', 'rollCount')
            usageStore.createIndex('by-lastRolled', 'lastRolled')
          }
        }
      },
    })
  }
  return dbPromise
}

// ============================================================================
// Collection Operations
// ============================================================================

/**
 * Save a collection to the database.
 * Creates new or updates existing by ID.
 */
export async function saveCollection(collection: StoredCollection): Promise<void> {
  const db = await init()
  await db.put('collections', collection)
}

/** Atomically persist an import batch so failed writes preserve all originals. */
export async function saveCollections(collections: StoredCollection[]): Promise<void> {
  const database = await init()
  const tx = database.transaction('collections', 'readwrite')
  try {
    for (const collection of collections) await tx.store.put(collection)
    await tx.done
  } catch (error) {
    try { tx.abort() } catch { /* An asynchronous request may already have aborted it. */ }
    await tx.done.catch(() => undefined)
    throw error
  }
}

/** Run a synchronous collection mutation against the latest records in one transaction.
 * IndexedDB serializes this transaction with writes from other browser tabs.
 */
export async function updateCollections(
  update: (current: Map<string, StoredCollection>) => StoredCollection[]
): Promise<Map<string, StoredCollection>> {
  const database = await init()
  const tx = database.transaction('collections', 'readwrite')
  try {
    const current = new Map((await tx.store.getAll()).map((record) => [record.id, record]))
    for (const record of update(current)) {
      await tx.store.put(record)
      current.set(record.id, record)
    }
    await tx.done
    return current
  } catch (error) {
    try { tx.abort() } catch { /* Request failure may have already aborted. */ }
    await tx.done.catch(() => undefined)
    throw error
  }
}

export class CollectionConflictError extends Error {
  constructor() {
    super('This collection was changed in another tab. Copy your unsaved changes, then reload the collection before saving.')
    this.name = 'CollectionConflictError'
  }
}

/** Compare documents too so older clients without revision support remain protected. */
export function assertCollectionRevision(current: StoredCollection | undefined, expected: StoredCollection | undefined): void {
  if (!!current !== !!expected || (current && expected &&
    ((current.revision ?? 0) !== (expected.revision ?? 0) || JSON.stringify(current.document) !== JSON.stringify(expected.document)))) {
    throw new CollectionConflictError()
  }
}

/**
 * Get a collection by ID.
 */
export async function getCollection(id: string): Promise<StoredCollection | undefined> {
  const db = await init()
  return db.get('collections', id)
}

/**
 * Get all collections.
 */
export async function getAllCollections(): Promise<StoredCollection[]> {
  const db = await init()
  return db.getAll('collections')
}

/**
 * Get collections by namespace.
 */
export async function getCollectionsByNamespace(namespace: string): Promise<StoredCollection[]> {
  const db = await init()
  return db.getAllFromIndex('collections', 'by-namespace', namespace)
}

/**
 * Check if a collection exists by ID.
 */
export async function collectionExists(id: string): Promise<boolean> {
  const collection = await getCollection(id)
  return collection !== undefined
}

/**
 * Delete a collection by ID.
 */
export async function deleteCollection(id: string): Promise<void> {
  const db = await init()
  const tx = db.transaction(['collections', 'favorites', 'usageStats'], 'readwrite')
  await tx.objectStore('collections').delete(id)
  const favorites = await tx.objectStore('favorites').index('by-collection').getAllKeys(id)
  for (const key of favorites) await tx.objectStore('favorites').delete(key)
  let cursor = await tx.objectStore('usageStats').openCursor()
  while (cursor) {
    if (cursor.value.collectionId === id) await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

/** Repair metadata left behind by older application versions. Keep roll history. */
export async function cleanupOrphanedCollectionMetadata(): Promise<void> {
  const database = await init()
  const tx = database.transaction(['collections', 'favorites', 'usageStats'], 'readwrite')
  const existing = new Set(await tx.objectStore('collections').getAllKeys())
  for (const name of ['favorites', 'usageStats'] as const) {
    let cursor = await tx.objectStore(name).openCursor()
    while (cursor) {
      if (!existing.has(cursor.value.collectionId)) await cursor.delete()
      cursor = await cursor.continue()
    }
  }
  await tx.done
}

/**
 * Get all user (non-preloaded) collections.
 */
export async function getUserCollections(): Promise<StoredCollection[]> {
  const all = await getAllCollections()
  return all.filter((c) => !c.isPreloaded)
}

/**
 * Get all preloaded collections.
 */
export async function getPreloadedCollections(): Promise<StoredCollection[]> {
  const all = await getAllCollections()
  return all.filter((c) => c.isPreloaded)
}

/**
 * Update a collection's hidden state.
 */
export async function setCollectionHidden(id: string, hidden: boolean): Promise<void> {
  const db = await init()
  const tx = db.transaction('collections', 'readwrite')
  const collection = await tx.store.get(id)
  if (collection) {
    collection.hiddenFromUI = hidden
    collection.updatedAt = Date.now()
    await tx.store.put(collection)
  }
  await tx.done
}

/**
 * Get all hidden preloaded collections.
 */
export async function getHiddenPreloadedCollections(): Promise<StoredCollection[]> {
  const all = await getAllCollections()
  return all.filter((c) => c.isPreloaded && c.hiddenFromUI)
}

/**
 * Restore all hidden preloaded collections.
 */
export async function restoreHiddenPreloadedCollections(): Promise<number> {
  const db = await init()
  const tx = db.transaction('collections', 'readwrite')
  const hidden = (await tx.store.getAll()).filter((record) => record.isPreloaded && record.hiddenFromUI)

  for (const collection of hidden) {
    collection.hiddenFromUI = false
    collection.updatedAt = Date.now()
    await tx.store.put(collection)
  }

  await tx.done
  return hidden.length
}

// ============================================================================
// Roll History Operations
// ============================================================================

/**
 * Save a roll to history.
 * Returns the auto-generated ID.
 */
export async function saveRoll(roll: Omit<StoredRoll, 'id'>): Promise<number> {
  const db = await init()
  return db.add('rollHistory', roll as StoredRoll)
}

/**
 * Get roll history, ordered by most recent first.
 * @param limit Maximum number of rolls to return
 */
export async function getRollHistory(limit = 100): Promise<StoredRoll[]> {
  const db = await init()
  const tx = db.transaction('rollHistory', 'readonly')
  const index = tx.store.index('by-timestamp')
  const results: StoredRoll[] = []

  // Iterate in reverse (newest first)
  let cursor = await index.openCursor(null, 'prev')
  while (cursor && results.length < limit) {
    results.push(cursor.value)
    cursor = await cursor.continue()
  }

  return results
}

/**
 * Get roll history for a specific collection.
 */
export async function getRollHistoryByCollection(
  collectionId: string,
  limit = 100
): Promise<StoredRoll[]> {
  const db = await init()
  const all = await db.getAllFromIndex('rollHistory', 'by-collection', collectionId)
  // Sort by timestamp descending and limit
  return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
}

/**
 * Get pinned rolls.
 */
export async function getPinnedRolls(): Promise<StoredRoll[]> {
  const database = await init()
  const tx = database.transaction('rollHistory', 'readonly')
  const results: StoredRoll[] = []
  let cursor = await tx.store.index('by-timestamp').openCursor(null, 'prev')
  while (cursor) {
    if (cursor.value.pinned) results.push(cursor.value)
    cursor = await cursor.continue()
  }
  await tx.done
  return results
}

/** Recent unpinned rolls plus every retained pin, ordered newest first. */
export async function getRetainedRollHistory(limit = 100): Promise<StoredRoll[]> {
  const database = await init()
  const tx = database.transaction('rollHistory', 'readonly')
  const results: StoredRoll[] = []
  const max = Math.max(0, Math.floor(limit))
  let unpinned = 0
  let cursor = await tx.store.index('by-timestamp').openCursor(null, 'prev')
  while (cursor) {
    if (cursor.value.pinned || unpinned < max) {
      results.push(cursor.value)
      if (!cursor.value.pinned) unpinned++
    }
    cursor = await cursor.continue()
  }
  await tx.done
  return results
}

/**
 * Pin or unpin a roll.
 */
export async function pinRoll(id: number, pinned: boolean): Promise<void> {
  const db = await init()
  const tx = db.transaction('rollHistory', 'readwrite')
  const roll = await tx.store.get(id)
  if (roll) await tx.store.put({ ...roll, pinned })
  await tx.done
}

/**
 * Delete a specific roll from history.
 */
export async function deleteRoll(id: number): Promise<void> {
  const db = await init()
  await db.delete('rollHistory', id)
}

/**
 * Clear all roll history (except pinned).
 */
export async function clearHistory(keepPinned = true): Promise<void> {
  const db = await init()

  if (keepPinned) {
    const all = await db.getAll('rollHistory')
    const toDelete = all.filter((r) => !r.pinned)
    const tx = db.transaction('rollHistory', 'readwrite')
    await Promise.all(toDelete.map((r) => tx.store.delete(r.id!)))
    await tx.done
  } else {
    await db.clear('rollHistory')
  }
}

/**
 * Trim history to keep only the most recent N entries (plus pinned).
 */
export async function trimHistory(maxEntries: number): Promise<void> {
  if (!Number.isFinite(maxEntries) || maxEntries < 0) throw new Error('Invalid history limit')
  const database = await init()
  const tx = database.transaction('rollHistory', 'readwrite')
  const max = Math.floor(maxEntries)
  let retained = 0
  let cursor = await tx.store.index('by-timestamp').openCursor(null, 'prev')
  while (cursor) {
    if (!cursor.value.pinned) {
      if (retained++ >= max) await cursor.delete()
    }
    cursor = await cursor.continue()
  }
  await tx.done
}

// ============================================================================
// User Preferences Operations
// ============================================================================

const DEFAULT_PREFERENCES: UserPreferences = {
  id: 'preferences',
  theme: 'system',
  historyLimit: 100,
}

/**
 * Get user preferences.
 * Returns defaults if not set.
 */
export async function getPreferences(): Promise<UserPreferences> {
  const db = await init()
  const prefs = await db.get('userPreferences', 'preferences')
  return prefs ?? DEFAULT_PREFERENCES
}

/**
 * Save user preferences.
 */
export async function savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
  const db = await init()
  const current = await getPreferences()
  const updated: UserPreferences = {
    ...current,
    ...preferences,
    id: 'preferences', // Ensure ID is always correct
  }
  await db.put('userPreferences', updated)
}

// ============================================================================
// Favorites Operations
// ============================================================================

/**
 * Generate a favorite ID from its components.
 */
export function generateFavoriteId(
  collectionId: string,
  type: 'table' | 'template',
  itemId: string
): string {
  return `${collectionId}:${type}:${itemId}`
}

/**
 * Get all favorites.
 */
export async function getAllFavorites(): Promise<StoredFavorite[]> {
  const db = await init()
  return db.getAll('favorites')
}

/**
 * Get favorites ordered by creation date (newest first).
 */
export async function getFavoritesByCreated(): Promise<StoredFavorite[]> {
  const db = await init()
  const tx = db.transaction('favorites', 'readonly')
  const index = tx.store.index('by-created')
  const results: StoredFavorite[] = []

  let cursor = await index.openCursor(null, 'prev')
  while (cursor) {
    results.push(cursor.value)
    cursor = await cursor.continue()
  }

  return results
}

/**
 * Get favorites for a specific collection.
 */
export async function getFavoritesByCollection(collectionId: string): Promise<StoredFavorite[]> {
  const db = await init()
  return db.getAllFromIndex('favorites', 'by-collection', collectionId)
}

/**
 * Check if an item is favorited.
 */
export async function isFavorite(
  collectionId: string,
  type: 'table' | 'template',
  itemId: string
): Promise<boolean> {
  const db = await init()
  const id = generateFavoriteId(collectionId, type, itemId)
  const favorite = await db.get('favorites', id)
  return favorite !== undefined
}

/**
 * Add a favorite.
 */
export async function addFavorite(
  collectionId: string,
  type: 'table' | 'template',
  itemId: string
): Promise<StoredFavorite | undefined> {
  const database = await init()
  const tx = database.transaction(['collections', 'favorites'], 'readwrite')
  const store = tx.objectStore('favorites')
  if (!await tx.objectStore('collections').get(collectionId)) {
    await tx.done
    return undefined
  }
  const id = generateFavoriteId(collectionId, type, itemId)
  const existing = await store.get(id)
  if (existing) {
    await tx.done
    return existing
  }
  const all = await store.getAll()
  const maxSortOrder = all.reduce((max, favorite) => Math.max(max, favorite.sortOrder), 0)
  const favorite: StoredFavorite = { id, collectionId, itemId, type, createdAt: Date.now(), sortOrder: maxSortOrder + 1 }
  await store.put(favorite)
  await tx.done
  return favorite
}

/**
 * Remove a favorite.
 */
export async function removeFavorite(
  collectionId: string,
  type: 'table' | 'template',
  itemId: string
): Promise<void> {
  const db = await init()
  const id = generateFavoriteId(collectionId, type, itemId)
  await db.delete('favorites', id)
}

/**
 * Update favorite sort orders (for reordering).
 */
export async function updateFavoriteSortOrders(
  orderedIds: string[]
): Promise<void> {
  const db = await init()
  const tx = db.transaction('favorites', 'readwrite')

  for (let i = 0; i < orderedIds.length; i++) {
    const favorite = await tx.store.get(orderedIds[i])
    if (favorite) {
      favorite.sortOrder = i
      await tx.store.put(favorite)
    }
  }

  await tx.done
}

/**
 * Remove all favorites for a collection (cleanup when collection is deleted).
 */
export async function removeFavoritesByCollection(collectionId: string): Promise<void> {
  const db = await init()
  const favorites = await getFavoritesByCollection(collectionId)
  const tx = db.transaction('favorites', 'readwrite')
  await Promise.all(favorites.map((f) => tx.store.delete(f.id)))
  await tx.done
}

// ============================================================================
// Usage Stats Operations
// ============================================================================

/**
 * Generate a usage stats ID from its components.
 */
export function generateUsageStatsId(
  collectionId: string,
  type: 'table' | 'template',
  itemId: string
): string {
  return `${collectionId}:${type}:${itemId}`
}

/**
 * Get all usage stats.
 */
export async function getAllUsageStats(): Promise<UsageStats[]> {
  const db = await init()
  return db.getAll('usageStats')
}

/**
 * Record usage of a table or template.
 * Creates new record if doesn't exist, otherwise increments count.
 */
export async function recordUsage(
  collectionId: string,
  type: 'table' | 'template',
  itemId: string
): Promise<void> {
  const db = await init()
  const id = generateUsageStatsId(collectionId, type, itemId)
  const tx = db.transaction(['collections', 'usageStats'], 'readwrite')
  const store = tx.objectStore('usageStats')
  if (!await tx.objectStore('collections').get(collectionId)) {
    await tx.done
    return
  }
  const existing = await store.get(id)
  const now = Date.now()

  if (existing) {
    existing.rollCount += 1
    existing.lastRolled = now
    await store.put(existing)
  } else {
    const stats: UsageStats = {
      id,
      collectionId,
      itemId,
      type,
      rollCount: 1,
      lastRolled: now,
      firstRolled: now,
    }
    await store.put(stats)
  }
  await tx.done
}

/**
 * Get most recently used items.
 */
export async function getRecentUsage(limit = 10): Promise<UsageStats[]> {
  const db = await init()
  const tx = db.transaction('usageStats', 'readonly')
  const index = tx.store.index('by-lastRolled')
  const results: UsageStats[] = []

  let cursor = await index.openCursor(null, 'prev')
  while (cursor && results.length < limit) {
    results.push(cursor.value)
    cursor = await cursor.continue()
  }

  return results
}

/**
 * Get most popular items (by roll count).
 */
export async function getPopularUsage(limit = 10): Promise<UsageStats[]> {
  const db = await init()
  const tx = db.transaction('usageStats', 'readonly')
  const index = tx.store.index('by-rollCount')
  const results: UsageStats[] = []

  let cursor = await index.openCursor(null, 'prev')
  while (cursor && results.length < limit) {
    results.push(cursor.value)
    cursor = await cursor.continue()
  }

  return results
}

/**
 * Get usage stats for a specific item.
 */
export async function getUsageStats(
  collectionId: string,
  type: 'table' | 'template',
  itemId: string
): Promise<UsageStats | undefined> {
  const db = await init()
  const id = generateUsageStatsId(collectionId, type, itemId)
  return db.get('usageStats', id)
}

/**
 * Clear all usage stats.
 */
export async function clearUsageStats(): Promise<void> {
  const db = await init()
  await db.clear('usageStats')
}

/**
 * Remove usage stats for a collection (cleanup when collection is deleted).
 */
export async function removeUsageStatsByCollection(collectionId: string): Promise<void> {
  const db = await init()
  const all = await getAllUsageStats()
  const toDelete = all.filter((s) => s.collectionId === collectionId)
  const tx = db.transaction('usageStats', 'readwrite')
  await Promise.all(toDelete.map((s) => tx.store.delete(s.id)))
  await tx.done
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a collection ID from metadata.
 * Creates a URL-safe slug from namespace-name-version.
 */
export function generateCollectionId(
  namespace: string,
  name: string,
  version: string
): string {
  const base = `${namespace}-${name}-${version}`
  return base
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Check if a collection with similar metadata exists.
 * Used for conflict detection during import.
 */
export async function findSimilarCollection(
  namespace: string,
  name: string
): Promise<StoredCollection | undefined> {
  const byNamespace = await getCollectionsByNamespace(namespace)
  return byNamespace.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  )
}

/**
 * Close the database connection.
 * Useful for testing or cleanup.
 */
export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
}

/**
 * Delete the entire database.
 * Use with caution - primarily for testing.
 */
export async function deleteDatabase(): Promise<void> {
  await closeDatabase()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
