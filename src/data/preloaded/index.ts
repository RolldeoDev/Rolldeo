/**
 * Pre-loaded Collections
 *
 * These collections are bundled with the app and available immediately.
 * They demonstrate the features of the random table engine.
 */

import fantasyRpg from './fantasy-rpg.json'
import sciFi from './sci-fi.json'
import type { RandomTableDocument } from '../../engine/types'

export interface PreloadedCollection {
  /** Unique identifier for the collection */
  id: string
  /** The raw JSON document */
  document: RandomTableDocument
}

/**
 * All pre-loaded collections bundled with the app.
 */
export const preloadedCollections: PreloadedCollection[] = [
  {
    id: 'fantasy-rpg',
    document: fantasyRpg as unknown as RandomTableDocument,
  },
  {
    id: 'sci-fi',
    document: sciFi as unknown as RandomTableDocument,
  },
]

/**
 * Get a pre-loaded collection by ID.
 */
export function getPreloadedCollection(id: string): PreloadedCollection | undefined {
  return preloadedCollections.find((c) => c.id === id)
}

/**
 * Check if a collection ID is pre-loaded.
 */
export function isPreloadedCollection(id: string): boolean {
  return preloadedCollections.some((c) => c.id === id)
}
