/**
 * Namespace Utilities
 *
 * Functions for parsing, grouping, and filtering collections by namespace.
 * Namespaces follow the pattern: publisher.product.category
 * e.g., "sineNomine.starsWithoutNumber.worldTags"
 */

import type { CollectionMeta } from '@/stores/collectionStore'

/**
 * Split a namespace into its segments
 * @param namespace - Full namespace string (e.g., "sineNomine.starsWithoutNumber.worldTags")
 * @returns Array of segments
 */
export function getNamespaceSegments(namespace: string): string[] {
  if (!namespace) return []
  return namespace.split('.')
}

/**
 * Get the namespace prefix at a given depth
 * @param namespace - Full namespace string
 * @param depth - How many segments to include (1 = publisher, 2 = publisher.product)
 * @returns Namespace prefix
 */
export function parseNamespace(namespace: string, depth: 1 | 2): string {
  const segments = getNamespaceSegments(namespace)
  if (segments.length === 0) return 'Uncategorized'
  return segments.slice(0, depth).join('.')
}

/**
 * Format a namespace segment for display (camelCase to Title Case)
 * @param segment - Namespace segment (e.g., "starsWithoutNumber")
 * @returns Formatted string (e.g., "Stars Without Number")
 */
export function formatNamespaceSegment(segment: string): string {
  if (!segment) return ''
  // Insert space before capital letters and capitalize first letter
  return segment
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

/**
 * Format a full namespace for display
 * @param namespace - Namespace prefix (e.g., "sineNomine.starsWithoutNumber")
 * @returns Formatted string (e.g., "Sine Nomine / Stars Without Number")
 */
export function formatNamespace(namespace: string): string {
  if (!namespace || namespace === 'Uncategorized') return 'Uncategorized'
  return getNamespaceSegments(namespace)
    .map(formatNamespaceSegment)
    .join(' / ')
}

/**
 * Get unique namespace prefixes from a collection of CollectionMeta
 * @param collections - Array of collection metadata
 * @param depth - Namespace depth (1 or 2)
 * @returns Sorted array of unique namespace prefixes
 */
export function getUniqueNamespaces(
  collections: CollectionMeta[],
  depth: 1 | 2
): string[] {
  const namespaces = new Set<string>()

  for (const collection of collections) {
    const prefix = parseNamespace(collection.namespace, depth)
    namespaces.add(prefix)
  }

  return Array.from(namespaces).sort((a, b) => {
    // Put "Uncategorized" last
    if (a === 'Uncategorized') return 1
    if (b === 'Uncategorized') return -1
    return a.localeCompare(b)
  })
}

/**
 * Group collections by their namespace prefix
 * @param collections - Array of collection metadata
 * @param depth - Namespace depth (1 or 2)
 * @returns Map of namespace prefix to collections
 */
export function groupCollectionsByNamespace(
  collections: CollectionMeta[],
  depth: 1 | 2
): Map<string, CollectionMeta[]> {
  const groups = new Map<string, CollectionMeta[]>()

  for (const collection of collections) {
    const prefix = parseNamespace(collection.namespace, depth)

    if (!groups.has(prefix)) {
      groups.set(prefix, [])
    }
    groups.get(prefix)!.push(collection)
  }

  // Sort collections within each group by name
  for (const [, groupCollections] of groups) {
    groupCollections.sort((a, b) => a.name.localeCompare(b.name))
  }

  // Return sorted by namespace key
  const sortedGroups = new Map<string, CollectionMeta[]>()
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === 'Uncategorized') return 1
    if (b === 'Uncategorized') return -1
    return a.localeCompare(b)
  })

  for (const key of sortedKeys) {
    sortedGroups.set(key, groups.get(key)!)
  }

  return sortedGroups
}

/**
 * Filter collections by namespace prefix
 * @param collections - Array of collection metadata
 * @param namespaceFilter - Namespace prefix to filter by (null = no filter)
 * @param depth - Namespace depth for matching
 * @returns Filtered collections
 */
export function filterCollectionsByNamespace(
  collections: CollectionMeta[],
  namespaceFilter: string | null,
  depth: 1 | 2
): CollectionMeta[] {
  if (!namespaceFilter) return collections

  return collections.filter((collection) => {
    const prefix = parseNamespace(collection.namespace, depth)
    return prefix === namespaceFilter
  })
}

/**
 * Check if a collection matches a search query
 * @param collection - Collection metadata
 * @param query - Search query (case-insensitive)
 * @returns True if collection matches
 */
export function collectionMatchesSearch(
  collection: CollectionMeta,
  query: string
): boolean {
  if (!query) return true

  const lowerQuery = query.toLowerCase()

  return (
    collection.name.toLowerCase().includes(lowerQuery) ||
    collection.namespace.toLowerCase().includes(lowerQuery) ||
    (collection.description?.toLowerCase().includes(lowerQuery) ?? false) ||
    collection.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
    (collection.author?.toLowerCase().includes(lowerQuery) ?? false) ||
    (collection.sourceBook?.toLowerCase().includes(lowerQuery) ?? false) ||
    (collection.sourcePublisher?.toLowerCase().includes(lowerQuery) ?? false)
  )
}
