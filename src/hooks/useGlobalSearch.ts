/**
 * useGlobalSearch Hook
 *
 * Provides fuzzy search across all tables and templates in all collections.
 * Used by the command palette for global search functionality.
 */

import { useMemo } from 'react'
import { useCollectionStore } from '@/stores/collectionStore'
import type { BrowserItem } from './useBrowserFilter'

export interface SearchResult {
  item: BrowserItem
  collectionId: string
  collectionName: string
  namespace: string
  score: number
}

interface UseGlobalSearchOptions {
  /** Maximum number of results to return */
  limit?: number
  /** Include hidden tables in results */
  includeHidden?: boolean
}

/**
 * Simple fuzzy matching function.
 * Returns a score based on how well the query matches the text.
 * Higher score = better match.
 */
function fuzzyScore(query: string, text: string): number {
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()

  // Exact match
  if (textLower === queryLower) {
    return 100
  }

  // Starts with query
  if (textLower.startsWith(queryLower)) {
    return 90
  }

  // Contains query as substring
  if (textLower.includes(queryLower)) {
    return 70 + (queryLower.length / textLower.length) * 20
  }

  // Check for word boundary matches
  const words = textLower.split(/\s+/)
  for (const word of words) {
    if (word.startsWith(queryLower)) {
      return 60
    }
  }

  // Fuzzy character matching (all query chars appear in order)
  let queryIndex = 0
  let matchScore = 0
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matchScore += 1
      queryIndex++
    }
  }

  if (queryIndex === queryLower.length) {
    // All characters found in order
    return 30 + (matchScore / textLower.length) * 20
  }

  return 0
}

/**
 * Calculate overall search score for an item.
 */
function calculateScore(
  query: string,
  item: BrowserItem,
  collectionName: string
): number {
  // Weight name matches most heavily
  const nameScore = fuzzyScore(query, item.name) * 1.0

  // Description matches
  const descScore = item.description
    ? fuzzyScore(query, item.description) * 0.5
    : 0

  // Tag matches
  const tagScore = item.tags
    ? Math.max(...item.tags.map((tag) => fuzzyScore(query, tag))) * 0.4
    : 0

  // Collection name matches (lower weight)
  const collectionScore = fuzzyScore(query, collectionName) * 0.3

  return Math.max(nameScore, descScore, tagScore, collectionScore)
}

/**
 * Hook for global search across all collections.
 */
export function useGlobalSearch(
  query: string,
  options: UseGlobalSearchOptions = {}
): SearchResult[] {
  const { limit = 50, includeHidden = false } = options

  // Subscribe to the raw collections Map - convert to array inside useMemo
  // (converting inside the selector creates a new array every time, causing infinite loops)
  const collectionsMap = useCollectionStore((state) => state.collections)

  return useMemo(() => {
    const collections = Array.from(collectionsMap.values())
    // Don't search with empty query
    if (!query || query.length < 2) {
      return []
    }

    // Get functions via getState() to avoid dependency issues
    const { getTableList, getTemplateList } = useCollectionStore.getState()

    const trimmedQuery = query.trim()
    const results: SearchResult[] = []

    for (const collection of collections) {
      // Skip hidden collections
      if (collection.hiddenFromUI) continue

      const tables = getTableList(collection.id)
      const templates = getTemplateList(collection.id)

      // Process tables
      for (const table of tables) {
        // Skip hidden tables unless explicitly included
        if (table.hidden && !includeHidden) continue

        const item: BrowserItem = {
          id: table.id,
          name: table.name,
          type: 'table',
          tableType: table.type,
          description: table.description,
          tags: table.tags,
          hidden: table.hidden,
          entryCount: table.entryCount,
          resultType: table.resultType,
        }

        const score = calculateScore(trimmedQuery, item, collection.name)
        if (score > 0) {
          results.push({
            item,
            collectionId: collection.id,
            collectionName: collection.name,
            namespace: collection.namespace,
            score,
          })
        }
      }

      // Process templates
      for (const template of templates) {
        const item: BrowserItem = {
          id: template.id,
          name: template.name,
          type: 'template',
          description: template.description,
          tags: template.tags,
          resultType: template.resultType,
        }

        const score = calculateScore(trimmedQuery, item, collection.name)
        if (score > 0) {
          results.push({
            item,
            collectionId: collection.id,
            collectionName: collection.name,
            namespace: collection.namespace,
            score,
          })
        }
      }
    }

    // Sort by score (descending) and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }, [query, collectionsMap, limit, includeHidden]) // No function deps - use getState() inside
}

export default useGlobalSearch
