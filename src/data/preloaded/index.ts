/**
 * Pre-loaded Collections
 *
 * These collections are bundled with the app and available immediately.
 * They demonstrate the features of the random table engine.
 */

import eldritchHorror from './rolldeo.horror.eldritch.json'
import fantasyWorld from './rolldeo.fantasy.world.json'
import scifiFrontier from './rolldeo.scifi.frontier.json'
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
    id: 'rolldeo.horror.eldritch',
    document: eldritchHorror as unknown as RandomTableDocument,
  },
  {
    id: 'rolldeo.fantasy.world',
    document: fantasyWorld as unknown as RandomTableDocument,
  },
  {
    id: 'rolldeo.scifi.frontier',
    document: scifiFrontier as unknown as RandomTableDocument,
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
