/**
 * useCollections Hook
 *
 * Provides convenient access to collections with filtering and initialization.
 */

import { useEffect, useMemo } from 'react'
import { useCollectionStore, type CollectionMeta } from '../stores/collectionStore'
import { useUIStore } from '../stores/uiStore'

export interface UseCollectionsReturn {
  // Collections
  collections: CollectionMeta[]
  preloaded: CollectionMeta[]
  userCollections: CollectionMeta[]
  allTags: string[]

  // State
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  deleteCollection: (id: string) => Promise<void>
  importFiles: (files: File[]) => Promise<import('../services/import').ImportResult>
}

/**
 * Hook for accessing and filtering collections.
 * Automatically initializes the collection store on first use.
 */
export function useCollections(): UseCollectionsReturn {
  const {
    collections,
    isLoading,
    isInitialized,
    error,
    initialize,
    deleteCollection,
    importFiles,
    getAllTags,
  } = useCollectionStore()

  const { searchQuery, selectedTags } = useUIStore()

  // Initialize on first use
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize()
    }
  }, [isInitialized, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter collections based on search and tags
  const filteredCollections = useMemo(() => {
    return Array.from(collections.values()).filter((c) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = c.name.toLowerCase().includes(query)
        const matchesDescription = c.description?.toLowerCase().includes(query)
        const matchesNamespace = c.namespace.toLowerCase().includes(query)
        const matchesTags = c.tags.some((t) => t.toLowerCase().includes(query))

        if (!matchesName && !matchesDescription && !matchesNamespace && !matchesTags) {
          return false
        }
      }

      // Tag filter
      if (selectedTags.length > 0) {
        if (!selectedTags.some((t) => c.tags.includes(t))) {
          return false
        }
      }

      return true
    })
  }, [collections, searchQuery, selectedTags])

  return {
    collections: filteredCollections,
    preloaded: filteredCollections.filter((c) => c.isPreloaded),
    userCollections: filteredCollections.filter((c) => !c.isPreloaded),
    allTags: getAllTags(),
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
