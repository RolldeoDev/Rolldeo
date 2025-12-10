/**
 * useCollections Hook
 *
 * Provides convenient access to collections with filtering and initialization.
 */

import { useEffect, useMemo, useCallback } from 'react'
import { useCollectionStore, type CollectionMeta } from '../stores/collectionStore'
import { useUIStore, type NamespaceDepth } from '../stores/uiStore'
import {
  getUniqueNamespaces,
  groupCollectionsByNamespace,
  parseNamespace,
  collectionMatchesSearch,
} from '../lib/namespaceUtils'

export interface UseCollectionsReturn {
  // Collections
  collections: CollectionMeta[]
  preloaded: CollectionMeta[]
  userCollections: CollectionMeta[]
  allTags: string[]

  // Namespace organization
  allNamespaces: string[]
  groupedCollections: Map<string, CollectionMeta[]>

  // State
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  deleteCollection: (id: string) => Promise<void>
  importFiles: (files: File[]) => Promise<import('../services/import').ImportResult>
}

export interface UseCollectionsOptions {
  /** Namespace filter (uses library namespace filter if not specified) */
  namespaceFilter?: string | null
  /** Namespace depth for grouping (uses library group depth if not specified) */
  namespaceDepth?: NamespaceDepth
  /** Use roller filters instead of library filters */
  useRollerFilters?: boolean
}

/**
 * Hook for accessing and filtering collections.
 * Automatically initializes the collection store on first use.
 */
export function useCollections(options: UseCollectionsOptions = {}): UseCollectionsReturn {
  const {
    collections,
    isLoading,
    isInitialized,
    error,
    initialize,
    deleteCollection,
    importFiles,
    getAllTags,
    getTableList,
    getTemplateList,
  } = useCollectionStore()

  const {
    searchQuery,
    selectedTags,
    libraryNamespaceFilter,
    libraryGroupDepth,
    rollerNamespaceFilter,
    rollerCollectionSearchQuery,
  } = useUIStore()

  // Determine which filters to use
  const useRollerFilters = options.useRollerFilters ?? false
  const effectiveSearchQuery = useRollerFilters ? rollerCollectionSearchQuery : searchQuery
  const effectiveNamespaceFilter = options.namespaceFilter !== undefined
    ? options.namespaceFilter
    : (useRollerFilters ? rollerNamespaceFilter : libraryNamespaceFilter)
  const effectiveNamespaceDepth = options.namespaceDepth ?? libraryGroupDepth

  // Initialize on first use
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize()
    }
  }, [isInitialized, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if any item in a collection matches the search query
  const collectionHasMatchingItems = useCallback((collectionId: string, query: string): boolean => {
    const lowerQuery = query.toLowerCase()

    // Check tables
    const tables = getTableList(collectionId)
    for (const table of tables) {
      if (table.name.toLowerCase().includes(lowerQuery)) return true
      if (table.description?.toLowerCase().includes(lowerQuery)) return true
      if (table.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) return true
    }

    // Check templates
    const templates = getTemplateList(collectionId)
    for (const template of templates) {
      if (template.name.toLowerCase().includes(lowerQuery)) return true
      if (template.description?.toLowerCase().includes(lowerQuery)) return true
      if (template.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) return true
    }

    return false
  }, [getTableList, getTemplateList])

  // Get all collections as array
  const allCollections = useMemo(() => {
    return Array.from(collections.values())
  }, [collections])

  // Get all unique namespaces (before filtering)
  const allNamespaces = useMemo(() => {
    return getUniqueNamespaces(allCollections, effectiveNamespaceDepth)
  }, [allCollections, effectiveNamespaceDepth])

  // Filter collections based on search, tags, and namespace
  const filteredCollections = useMemo(() => {
    return allCollections.filter((c) => {
      // Hide collections marked as hiddenFromUI
      if (c.hiddenFromUI) {
        return false
      }

      // Namespace filter
      if (effectiveNamespaceFilter) {
        const prefix = parseNamespace(c.namespace, effectiveNamespaceDepth)
        if (prefix !== effectiveNamespaceFilter) {
          return false
        }
      }

      // Search filter
      if (effectiveSearchQuery) {
        // For roller, also search within items (tables/templates)
        if (useRollerFilters) {
          const collectionMatches = collectionMatchesSearch(c, effectiveSearchQuery)
          const itemsMatch = collectionHasMatchingItems(c.id, effectiveSearchQuery)
          if (!collectionMatches && !itemsMatch) {
            return false
          }
        } else {
          // For library, only search collection metadata
          if (!collectionMatchesSearch(c, effectiveSearchQuery)) {
            return false
          }
        }
      }

      // Tag filter (only for library, not roller)
      if (!useRollerFilters && selectedTags.length > 0) {
        if (!selectedTags.some((t) => c.tags.includes(t))) {
          return false
        }
      }

      return true
    })
  }, [allCollections, effectiveSearchQuery, selectedTags, effectiveNamespaceFilter, effectiveNamespaceDepth, useRollerFilters, collectionHasMatchingItems])

  // Group filtered collections by namespace
  const groupedCollections = useMemo(() => {
    return groupCollectionsByNamespace(filteredCollections, effectiveNamespaceDepth)
  }, [filteredCollections, effectiveNamespaceDepth])

  return {
    collections: filteredCollections,
    preloaded: filteredCollections.filter((c) => c.isPreloaded),
    userCollections: filteredCollections.filter((c) => !c.isPreloaded),
    allTags: getAllTags(),
    allNamespaces,
    groupedCollections,
    isLoading,
    isInitialized,
    error,
    deleteCollection,
    importFiles,
  }
}

/**
 * Hook for accessing a single collection by ID.
 */
export function useCollection(collectionId: string | null) {
  const { getCollection, getTableList, getTemplateList, isInitialized } =
    useCollectionStore()

  const collection = collectionId ? getCollection(collectionId) : undefined
  const tables = collectionId ? getTableList(collectionId) : []
  const templates = collectionId ? getTemplateList(collectionId) : []

  return {
    collection,
    tables,
    templates,
    isInitialized,
  }
}
