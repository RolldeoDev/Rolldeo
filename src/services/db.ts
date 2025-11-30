/**
 * IndexedDB Service
 *
 * Handles all persistence for collections, roll history, and user preferences.
 * Uses the `idb` library for type-safe IndexedDB access.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { RandomTableDocument, RollResult } from '../engine/types'

// ============================================================================
// Database Types
// ============================================================================

export interface StoredCollection {
  /** Primary key */
  id: string
  /** The raw JSON document for re-loading into engine */
  document: RandomTableDocument
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
  /** Creation timestamp */
  createdAt: number
  /** Last update timestamp */
  updatedAt: number
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
}

const DB_NAME = 'rolldeo-db'
const DB_VERSION = 1

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
      upgrade(db) {
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
  await db.delete('collections', id)
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
  const all = await getRollHistory(1000)
  return all.filter((r) => r.pinned)
}

/**
 * Pin or unpin a roll.
 */
export async function pinRoll(id: number, pinned: boolean): Promise<void> {
  const db = await init()
  const roll = await db.get('rollHistory', id)
  if (roll) {
    roll.pinned = pinned
    await db.put('rollHistory', roll)
  }
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
  const db = await init()
  const all = await getRollHistory(10000) // Get all

  const unpinned = all.filter((r) => !r.pinned)

  if (unpinned.length > maxEntries) {
    const toDelete = unpinned.slice(maxEntries)
    const tx = db.transaction('rollHistory', 'readwrite')
    await Promise.all(toDelete.map((r) => tx.store.delete(r.id!)))
    await tx.done
  }
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
