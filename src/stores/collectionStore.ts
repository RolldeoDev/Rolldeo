/**
 * Collection Store
 *
 * Central Zustand store for managing random table collections.
 * Bridges the RandomTableEngine with the UI and handles persistence.
 */

import { create } from 'zustand'
import { RandomTableEngine, type TableInfo, type TemplateInfo } from '../engine/core'
import type { RandomTableDocument } from '../engine/types'
import * as db from '../services/db'
import * as importService from '../services/import'
import { preloadedCollections } from '../data/preloaded'

// ============================================================================
// Types
// ============================================================================

export interface CollectionMeta {
  /** Unique identifier */
  id: string
  /** Display name */
  name: string
  /** Namespace from metadata */
  namespace: string
  /** Version from metadata */
  version: string
  /** Description from metadata */
  description?: string
  /** Tags for filtering */
  tags: string[]
  /** Number of tables in the collection */
  tableCount: number
  /** Number of templates in the collection */
  templateCount: number
  /** Whether this is a pre-loaded collection */
  isPreloaded: boolean
  /** Source of the collection */
  source: 'preloaded' | 'file' | 'zip' | 'user'
}

interface CollectionState {
  // State
  engine: RandomTableEngine
  collections: Map<string, CollectionMeta>
  isInitialized: boolean
  isLoading: boolean
  error: string | null

  // Actions
  initialize: () => Promise<void>
  loadCollection: (
    id: string,
    document: RandomTableDocument,
    isPreloaded?: boolean,
    source?: 'preloaded' | 'file' | 'zip' | 'user'
  ) => void
  saveCollection: (
    id: string,
    document: RandomTableDocument,
    source: 'file' | 'zip' | 'user'
  ) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  importFiles: (files: File[]) => Promise<importService.ImportResult>
  saveImportedCollections: (
    collections: importService.ImportedCollection[],
    source: 'file' | 'zip',
    pathToIdMap?: Map<string, string>
  ) => Promise<void>

  // Selectors
  getCollection: (id: string) => CollectionMeta | undefined
  getCollectionDocument: (id: string) => RandomTableDocument | undefined
  getPreloadedCollections: () => CollectionMeta[]
  getUserCollections: () => CollectionMeta[]
  getAllCollections: () => CollectionMeta[]
  getTableList: (collectionId: string) => TableInfo[]
  getTemplateList: (collectionId: string) => TemplateInfo[]
  getAllTags: () => string[]
}

// ============================================================================
// Store
// ============================================================================

export const useCollectionStore = create<CollectionState>()((set, get) => ({
  engine: new RandomTableEngine(),
  collections: new Map(),
  isInitialized: false,
  isLoading: false,
  error: null,

  /**
   * Initialize the store by loading pre-loaded and user collections.
   */
  initialize: async () => {
    const state = get()
    if (state.isInitialized) return

    set({ isLoading: true, error: null })

    try {
      // Initialize database
      await db.init()

      // Load all existing collections first (single DB call)
      const storedCollections = await db.getAllCollections()
      const existingIds = new Set(storedCollections.map((c) => c.id))

      // Find preloaded collections that need to be saved
      const now = Date.now()
      const toSave = preloadedCollections.filter(({ id }) => !existingIds.has(id))

      // Save missing preloaded collections in parallel
      await Promise.all(
        toSave.map(({ id, document }) =>
          db.saveCollection({
            id,
            document,
            name: document.metadata.name,
            namespace: document.metadata.namespace,
            version: document.metadata.version,
            description: document.metadata.description,
            tags: document.metadata.tags || [],
            isPreloaded: true,
            source: 'preloaded',
            createdAt: now,
            updatedAt: now,
          })
        )
      )

      // Load all preloaded collections into engine
      for (const { id, document } of preloadedCollections) {
        get().loadCollection(id, document, true, 'preloaded')
      }

      // Load user collections from database (already fetched above)
      for (const stored of storedCollections) {
        if (!stored.isPreloaded) {
          get().loadCollection(stored.id, stored.document, false, stored.source)
        }
      }

      // Build pathToIdMap from stored fileNames and resolve imports
      const pathToIdMap = new Map<string, string>()
      for (const stored of storedCollections) {
        if (stored.fileName) {
          // Add various path formats for flexible matching
          pathToIdMap.set(stored.fileName, stored.id)
          pathToIdMap.set(`./${stored.fileName}`, stored.id)
        }
      }
      if (pathToIdMap.size > 0) {
        get().engine.resolveImports(pathToIdMap)
      }

      set({ isInitialized: true, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isLoading: false,
      })
    }
  },

  /**
   * Load a collection into the engine and update state.
   */
  loadCollection: (id, document, isPreloaded = false, source = 'file') => {
    const { engine, collections } = get()

    // Load into engine
    engine.loadCollection(document, id, isPreloaded)

    // Create metadata
    const meta: CollectionMeta = {
      id,
      name: document.metadata.name,
      namespace: document.metadata.namespace,
      version: document.metadata.version,
      description: document.metadata.description,
      tags: document.metadata.tags || [],
      tableCount: document.tables.length,
      templateCount: document.templates?.length || 0,
      isPreloaded,
      source,
    }

    // Update state
    const newCollections = new Map(collections)
    newCollections.set(id, meta)
    set({ collections: newCollections })
  },

  /**
   * Delete a user collection.
   * Cannot delete pre-loaded collections.
   */
  deleteCollection: async (id) => {
    const { engine, collections } = get()
    const meta = collections.get(id)

    if (!meta) {
      throw new Error(`Collection not found: ${id}`)
    }

    if (meta.isPreloaded) {
      throw new Error('Cannot delete pre-loaded collection')
    }

    // Remove from engine
    engine.unloadCollection(id)

    // Remove from database
    await db.deleteCollection(id)

    // Update state
    const newCollections = new Map(collections)
    newCollections.delete(id)
    set({ collections: newCollections })
  },

  /**
   * Import files and return results.
   * Does NOT save to database - use saveImportedCollections for that.
   */
  importFiles: async (files) => {
    return importService.importFiles(files)
  },

  /**
   * Save imported collections to database and load into engine.
   */
  saveImportedCollections: async (collections, source, pathToIdMap) => {
    for (const collection of collections) {
      // Save to database
      await db.saveCollection({
        id: collection.id,
        document: collection.document,
        name: collection.name,
        namespace: collection.document.metadata.namespace,
        version: collection.document.metadata.version,
        description: collection.document.metadata.description,
        tags: collection.document.metadata.tags || [],
        isPreloaded: false,
        source,
        fileName: collection.fileName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      // Load into engine
      get().loadCollection(collection.id, collection.document, false, source)
    }

    // Resolve imports after all collections are loaded
    if (pathToIdMap && pathToIdMap.size > 0) {
      get().engine.resolveImports(pathToIdMap)
    }
  },

  /**
   * Save a collection to database and load into engine.
   * Used for creating/editing collections in the editor.
   */
  saveCollection: async (id, document, source) => {
    const existing = get().collections.get(id)
    const now = Date.now()

    // Get createdAt from existing record if updating, otherwise use now
    let createdAt = now
    if (existing) {
      const stored = await db.getCollection(id)
      createdAt = stored?.createdAt ?? now
    }

    // Save to database
    await db.saveCollection({
      id,
      document,
      name: document.metadata.name,
      namespace: document.metadata.namespace,
      version: document.metadata.version,
      description: document.metadata.description,
      tags: document.metadata.tags || [],
      isPreloaded: false,
      source,
      createdAt,
      updatedAt: now,
    })

    // Load into engine (this will replace if already loaded)
    get().loadCollection(id, document, false, source)
  },

  // ============================================================================
  // Selectors
  // ============================================================================

  getCollection: (id) => get().collections.get(id),

  getCollectionDocument: (id) => {
    // Get the document from the engine
    const loaded = get().engine.getCollection(id)
    return loaded?.document
  },

  getPreloadedCollections: () =>
    Array.from(get().collections.values()).filter((c) => c.isPreloaded),

  getUserCollections: () =>
    Array.from(get().collections.values()).filter((c) => !c.isPreloaded),

  getAllCollections: () => Array.from(get().collections.values()),

  getTableList: (collectionId) => {
    try {
      return get().engine.listTables(collectionId)
    } catch {
      return []
    }
  },

  getTemplateList: (collectionId) => {
    try {
      return get().engine.listTemplates(collectionId)
    } catch {
      return []
    }
  },

  getAllTags: () => {
    const tagSet = new Set<string>()
    for (const collection of get().collections.values()) {
      for (const tag of collection.tags) {
        tagSet.add(tag)
      }
    }
    return Array.from(tagSet).sort()
  },
}))

// ============================================================================
// Utility Selectors (for use with React)
// ============================================================================

/**
 * Check if a collection ID already exists.
 */
export function collectionExists(id: string): boolean {
  return useCollectionStore.getState().collections.has(id)
}

/**
 * Get existing collection IDs for conflict detection.
 */
export function getExistingCollectionIds(): Set<string> {
  return new Set(useCollectionStore.getState().collections.keys())
}
