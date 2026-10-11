/**
 * Collection Store
 *
 * Central Zustand store for managing random table collections.
 * Bridges the RandomTableEngine with the UI and handles persistence.
 */

import { create } from 'zustand'
import { RandomTableEngine, type TableInfo, type TemplateInfo, type ImportedTableInfo, type ImportedTemplateInfo } from '../engine/core'
import type { AuthoredRandomTableDocument } from '../engine/types'
import * as db from '../services/db'
import * as importService from '../services/import'
import { validateDocument } from '../engine/core/validator'
import { preloadedCollections } from '../data/preloaded'
import { useFavoriteStore } from './favoriteStore'
import { useUsageStore } from './usageStore'

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
  /** Author from metadata */
  author?: string
  /** Source book name from metadata.source */
  sourceBook?: string
  /** Publisher from metadata.source */
  sourcePublisher?: string
  /** If true, hidden from Library and Browser panels but available for rolling */
  hiddenFromUI?: boolean
  fileName?: string
  originalPath?: string
  bundleId?: string
}

export interface RejectedCollection {
  record: db.StoredCollection
  error: string
}

interface CollectionState {
  // State
  engine: RandomTableEngine
  collections: Map<string, CollectionMeta>
  records: Map<string, db.StoredCollection>
  rejectedCollections: Map<string, RejectedCollection>
  isInitialized: boolean
  isLoading: boolean
  error: string | null

  // Actions
  initialize: () => Promise<void>
  loadCollection: (
    id: string,
    document: AuthoredRandomTableDocument,
    isPreloaded?: boolean,
    source?: 'preloaded' | 'file' | 'zip' | 'user',
    hiddenFromUI?: boolean
  ) => void
  saveCollection: (
    id: string,
    document: AuthoredRandomTableDocument,
    source: 'file' | 'zip' | 'user'
  ) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  hideCollection: (id: string) => Promise<void>
  restoreHiddenCollections: () => Promise<number>
  importFiles: (files: File[]) => Promise<importService.ImportResult>
  saveImportedCollections: (
    collections: importService.ImportedCollection[],
    source: 'file' | 'zip',
    pathToIdMap?: Map<string, string>
  ) => Promise<importService.ImportedCollection[]>

  // Update a collection's document in the engine (for live editing)
  updateCollectionDocument: (id: string, document: AuthoredRandomTableDocument) => void

  // Selectors
  getRejectedCollections: () => RejectedCollection[]
  getCollection: (id: string) => CollectionMeta | undefined
  getCollectionDocument: (id: string) => AuthoredRandomTableDocument | undefined
  getPreloadedCollections: () => CollectionMeta[]
  getUserCollections: () => CollectionMeta[]
  getAllCollections: () => CollectionMeta[]
  getVisibleCollections: () => CollectionMeta[]
  getHiddenCollections: () => CollectionMeta[]
  getTableList: (collectionId: string) => TableInfo[]
  getTemplateList: (collectionId: string) => TemplateInfo[]
  getImportedTableList: (collectionId: string, includeHidden?: boolean) => ImportedTableInfo[]
  getImportedTemplateList: (collectionId: string) => ImportedTemplateInfo[]
  getAllTags: () => string[]
}

// Persist mutations in invocation order, including operations targeting the same ID.
let mutationTail: Promise<unknown> = Promise.resolve()
function mutate<T>(operation: () => Promise<T>): Promise<T> {
  const next = mutationTail.then(operation, operation)
  mutationTail = next.catch(() => undefined)
  return next
}

function assertValidDocument(document: AuthoredRandomTableDocument): void {
  const validation = validateDocument(document)
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join('; '))
}

/** Resolve every alias against an exact collection identity and scoped archive origin. */
export function buildImportBindings(records: Map<string, db.StoredCollection>): Map<string, Map<string, string>> {
  const bindings = new Map<string, Map<string, string>>()
  for (const record of records.values()) {
    const aliases = new Map<string, string>()
    const imports = record.document && Array.isArray(record.document.imports) ? record.document.imports : []
    for (const imp of imports) {
      if (!imp || typeof imp.alias !== 'string' || typeof imp.path !== 'string') continue
      const previous = record.resolvedImports?.[imp.alias]
      if (previous !== undefined && previous !== '') {
        aliases.set(imp.alias, previous)
        continue
      }
      let candidates: db.StoredCollection[] = []
      const normalized = importService.normalizeImportPath(imp.path, record.originalPath ?? record.fileName ?? '')
      // Filenames can bind only within their originating archive/file selection.
      if (record.bundleId && normalized !== undefined) {
        candidates = [...records.values()].filter((target) => target.bundleId === record.bundleId &&
          importService.normalizeImportPath(target.originalPath ?? target.fileName ?? '') === normalized)
      } else if (!record.bundleId && normalized !== undefined) {
        // Migration for old imports: only use a globally unique stored filename.
        candidates = [...records.values()].filter((target) => !target.bundleId && target.fileName &&
          importService.normalizeImportPath(target.fileName) === normalized)
      }
      if (!candidates.length) {
        const namespaces = [...records.values()].filter((target) => target.namespace === imp.path)
        const inBundle = namespaces.filter((target) => record.bundleId && target.bundleId === record.bundleId)
        candidates = inBundle.length ? inBundle : namespaces
      }
      if (!candidates.length && records.has(imp.path)) candidates = [records.get(imp.path)!]
      // Empty explicit binding prevents unrelated global fallback on missing/ambiguous imports.
      aliases.set(imp.alias, candidates.length === 1 ? candidates[0].id : '')
    }
    bindings.set(record.id, aliases)
  }
  return bindings
}

function preservedBindings(previous: db.StoredCollection | undefined, document: AuthoredRandomTableDocument): Record<string, string> {
  return Object.fromEntries((document.imports ?? []).filter((imp) =>
    Array.isArray(previous?.document?.imports) && previous.document.imports.some((old) => old && old.alias === imp.alias && old.path === imp.path) &&
    previous.resolvedImports?.[imp.alias] !== undefined).map((imp) => [imp.alias, previous!.resolvedImports![imp.alias]]))
}

function recordsWithBindings(records: Map<string, db.StoredCollection>): db.StoredCollection[] {
  const bindings = buildImportBindings(records)
  return [...records.values()].map((record) => ({ ...record,
    resolvedImports: Object.fromEntries(bindings.get(record.id) ?? []) }))
}

function bindingsChanged(previous: db.StoredCollection | undefined, next: db.StoredCollection): boolean {
  return JSON.stringify(previous?.resolvedImports ?? {}) !== JSON.stringify(next.resolvedImports ?? {})
}

/** Keep the document snapshot that the editor actually saw until it is reloaded.
 * A metadata refresh must not silently acknowledge another tab's document edit.
 */
function mergePersistedSnapshot(previous: Map<string, db.StoredCollection>, persisted: Map<string, db.StoredCollection>, writtenIds: Set<string>): Map<string, db.StoredCollection> {
  return new Map([...persisted].map(([id, record]) => {
    const local = previous.get(id)
    return [id, local && !writtenIds.has(id) && JSON.stringify(local.document) !== JSON.stringify(record.document) ? local : record]
  }))
}

function resolveRecords(engine: RandomTableEngine, records: Map<string, db.StoredCollection>): void {
  engine.resolveImports(undefined, buildImportBindings(records))
}

// ============================================================================
// Store
// ============================================================================

export const useCollectionStore = create<CollectionState>()((set, get) => ({
  engine: new RandomTableEngine(),
  collections: new Map(),
  records: new Map(),
  rejectedCollections: new Map(),
  isInitialized: false,
  isLoading: false,
  error: null,

  /**
   * Initialize the store by loading pre-loaded and user collections.
   */
  initialize: () => mutate(async () => {
    const state = get()
    if (state.isInitialized) return

    set({ isLoading: true, error: null })

    try {
      // Initialize database
      await db.init()

      // Reconcile current bundled content and bindings together, preserving visibility.
      const now = Date.now()
      const persisted = await db.updateCollections((current) => {
        const records = new Map(current)
        for (const { id, document, hiddenFromUI } of preloadedCollections) {
          const previous = current.get(id)
          const unchanged = previous && JSON.stringify(previous.document) === JSON.stringify(document)
          records.set(id, { ...previous, id, document, name: document.metadata.name,
            namespace: document.metadata.namespace, version: document.metadata.version,
            description: document.metadata.description, tags: document.metadata.tags ?? [],
            isPreloaded: true, source: 'preloaded', hiddenFromUI: previous?.hiddenFromUI ?? hiddenFromUI,
            resolvedImports: preservedBindings(previous, document), createdAt: previous?.createdAt ?? now,
            updatedAt: unchanged ? previous.updatedAt : now,
            revision: unchanged ? previous.revision : (previous?.revision ?? 0) + 1 })
        }
        return recordsWithBindings(records).filter((record) =>
          preloadedCollections.some(({ id }) => id === record.id) || bindingsChanged(current.get(record.id), record))
      })
      await db.cleanupOrphanedCollectionMetadata()
      const storedCollections = [...persisted.values()]
      set({ records: persisted })
      for (const record of storedCollections.filter((record) => record.isPreloaded)) {
        get().loadCollection(record.id, record.document, true, 'preloaded', record.hiddenFromUI)
      }

      // Legacy records may no longer satisfy the format. Keep their bytes for
      // recovery while allowing independent valid collections to initialize.
      const rejectedCollections = new Map<string, RejectedCollection>()
      for (const stored of storedCollections) {
        if (!stored.isPreloaded) {
          try { get().loadCollection(stored.id, stored.document, false, stored.source, stored.hiddenFromUI) }
          catch (error) { rejectedCollections.set(stored.id, { record: stored,
            error: error instanceof Error ? error.message : 'Invalid saved collection' }) }
        }
      }
      set({ rejectedCollections })

      const records = persisted
      resolveRecords(get().engine, records)

      set({ isInitialized: true, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isLoading: false,
      })
    }
  }),

  /**
   * Load a collection into the engine and update state.
   */
  loadCollection: (id, document, isPreloaded = false, source = 'file', hiddenFromUI = false) => {
    const { engine } = get()

    // Load into engine
    engine.loadCollection(document, id, isPreloaded)

    // Create metadata with author and source info
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
      // Extract author and source metadata
      author: document.metadata.author,
      sourceBook: document.metadata.source?.book,
      sourcePublisher: document.metadata.source?.publisher,
      hiddenFromUI,
      fileName: get().records.get(id)?.fileName,
      originalPath: get().records.get(id)?.originalPath,
      bundleId: get().records.get(id)?.bundleId,
    }

    // Update state
    set((state) => {
      const collections = new Map(state.collections)
      collections.set(id, meta)
      return { collections }
    })
  },

  /**
   * Delete a user collection.
   * Cannot delete pre-loaded collections.
   */
  deleteCollection: (id) => mutate(async () => {
    const meta = get().collections.get(id)
    if (!meta) throw new Error(`Collection not found: ${id}`)
    if (meta.isPreloaded) throw new Error('Cannot delete pre-loaded collection')
    await db.deleteCollection(id)
    // Persistence removes these records atomically; publish matching lists afterwards.
    useFavoriteStore.getState().forgetCollection(id)
    useUsageStore.getState().forgetCollection(id)
    get().engine.unloadCollection(id)
    set((state) => {
      const collections = new Map(state.collections)
      const records = new Map(state.records)
      collections.delete(id)
      records.delete(id)
      return { collections, records }
    })
    resolveRecords(get().engine, get().records)
  }),

  hideCollection: (id) => mutate(async () => {
    if (!get().collections.has(id)) throw new Error(`Collection not found: ${id}`)
    await db.setCollectionHidden(id, true)
    const stored = await db.getCollection(id)
    set((state) => {
      const collections = new Map(state.collections)
      const records = new Map(state.records)
      const meta = collections.get(id)
      if (meta) collections.set(id, { ...meta, hiddenFromUI: true })
      if (stored) records.set(id, { ...(records.get(id) ?? stored), hiddenFromUI: stored.hiddenFromUI })
      return { collections, records }
    })
  }),

  restoreHiddenCollections: () => mutate(async () => {
    const count = await db.restoreHiddenPreloadedCollections()
    const stored = await db.getAllCollections()
    set((state) => {
      const collections = new Map(state.collections)
      const records = new Map(state.records)
      for (const record of stored) {
        if (record.isPreloaded) records.set(record.id, record)
      }
      for (const [id, meta] of collections) {
        if (meta.isPreloaded && meta.hiddenFromUI) collections.set(id, { ...meta, hiddenFromUI: false })
      }
      return { collections, records }
    })
    return count
  }),

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
  saveImportedCollections: (incoming, source, _pathToIdMap) => mutate(async () => {
    let collections: importService.ImportedCollection[] = []
    void _pathToIdMap // Global basename maps cannot represent distinct archive identities.
    const now = Date.now()
    const records = await db.updateCollections((current) => {
      collections = importService.allocateImportBatch(incoming, new Set(current.keys())).collections
      const updated = new Map(current)
      for (const collection of collections) {
        assertValidDocument(collection.document)
        updated.set(collection.id, {
          id: collection.id, document: collection.document, name: collection.name,
          namespace: collection.document.metadata.namespace, version: collection.document.metadata.version,
          description: collection.document.metadata.description, tags: collection.document.metadata.tags ?? [],
          isPreloaded: false, source, fileName: collection.fileName, originalPath: collection.originalPath ?? collection.fileName,
          bundleId: collection.bundleId, createdAt: now, updatedAt: now, revision: 1,
        })
      }
      const ids = new Set(collections.map((collection) => collection.id))
      return recordsWithBindings(updated).filter((record) => ids.has(record.id) || bindingsChanged(current.get(record.id), record))
    })
    const rejectedCollections = new Map(get().rejectedCollections)
    for (const collection of collections) rejectedCollections.delete(collection.id)
    const snapshot = mergePersistedSnapshot(get().records, records, new Set(collections.map((collection) => collection.id)))
    set({ records: snapshot, rejectedCollections })
    for (const collection of collections) {
      const record = records.get(collection.id)!
      get().loadCollection(record.id, record.document, false, source, record.hiddenFromUI)
    }
    resolveRecords(get().engine, get().records)
    return collections
  }),

  saveCollection: (id, document, source) => mutate(async () => {
    assertValidDocument(document)
    const expected = get().records.get(id)
    const now = Date.now()
    const records = await db.updateCollections((current) => {
      const stored = current.get(id)
      db.assertCollectionRevision(stored, expected)
      const record: db.StoredCollection = {
        ...stored, id, document, name: document.metadata.name, namespace: document.metadata.namespace,
        version: document.metadata.version, description: document.metadata.description, tags: document.metadata.tags ?? [],
        isPreloaded: false, source, resolvedImports: preservedBindings(stored, document),
        createdAt: stored?.createdAt ?? now, updatedAt: now, revision: (stored?.revision ?? 0) + 1,
      }
      const updated = new Map(current)
      updated.set(id, record)
      return recordsWithBindings(updated).filter((next) => next.id === id || bindingsChanged(current.get(next.id), next))
    })
    const rejectedCollections = new Map(get().rejectedCollections)
    rejectedCollections.delete(id)
    const snapshot = mergePersistedSnapshot(get().records, records, new Set([id]))
    set({ records: snapshot, rejectedCollections })
    get().loadCollection(id, document, false, source, records.get(id)?.hiddenFromUI)
    resolveRecords(get().engine, get().records)
  }),

  /**
   * Update a collection's document in the engine (for live editing).
   * This keeps the engine in sync with editor changes without persisting to DB.
   */
  updateCollectionDocument: (id, document) => {
    assertValidDocument(document)
    get().engine.updateDocument(id, document)
  },

  // ============================================================================
  // Selectors
  // ============================================================================

  getRejectedCollections: () => [...get().rejectedCollections.values()],

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

  getVisibleCollections: () =>
    Array.from(get().collections.values()).filter((c) => !c.hiddenFromUI),

  getHiddenCollections: () =>
    Array.from(get().collections.values()).filter((c) => c.hiddenFromUI),

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

  getImportedTableList: (collectionId, includeHidden = true) => {
    try {
      return get().engine.listImportedTables(collectionId, includeHidden)
    } catch {
      return []
    }
  },

  getImportedTemplateList: (collectionId) => {
    try {
      return get().engine.listImportedTemplates(collectionId)
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
