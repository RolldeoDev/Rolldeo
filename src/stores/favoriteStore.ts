/**
 * Favorite Store
 *
 * Manages favorite tables and templates for quick access.
 * Persists to IndexedDB for cross-session persistence.
 */

import { create } from 'zustand'
import * as db from '../services/db'
import type { StoredFavorite } from '../services/db'

// ============================================================================
// Types
// ============================================================================

interface FavoriteState {
  // State
  favorites: Map<string, StoredFavorite>
  isLoaded: boolean
  loadError: string | null

  // Actions
  loadFavorites: () => Promise<void>
  addFavorite: (
    collectionId: string,
    itemId: string,
    type: 'table' | 'template'
  ) => Promise<void>
  removeFavorite: (
    collectionId: string,
    itemId: string,
    type: 'table' | 'template'
  ) => Promise<void>
  toggleFavorite: (
    collectionId: string,
    itemId: string,
    type: 'table' | 'template'
  ) => Promise<void>
  isFavorite: (
    collectionId: string,
    itemId: string,
    type: 'table' | 'template'
  ) => boolean
  getFavorites: () => StoredFavorite[]
  removeByCollection: (collectionId: string) => Promise<void>
}

// ============================================================================
// Store
// ============================================================================

export const useFavoriteStore = create<FavoriteState>()((set, get) => ({
  // Initial state
  favorites: new Map(),
  isLoaded: false,
  loadError: null,

  // ========================================================================
  // Actions
  // ========================================================================

  /**
   * Load all favorites from database.
   */
  loadFavorites: async () => {
    if (get().isLoaded) return

    try {
      const favorites = await db.getAllFavorites()
      const favoritesMap = new Map<string, StoredFavorite>()
      for (const fav of favorites) {
        favoritesMap.set(fav.id, fav)
      }

      set({
        favorites: favoritesMap,
        isLoaded: true,
        loadError: null,
      })
    } catch (error) {
      console.error('Failed to load favorites:', error)
      set({
        isLoaded: true,
        loadError: error instanceof Error ? error.message : 'Failed to load favorites',
      })
    }
  },

  /**
   * Add an item to favorites.
   */
  addFavorite: async (collectionId, itemId, type) => {
    try {
      await db.addFavorite(collectionId, type, itemId)

      const id = db.generateFavoriteId(collectionId, type, itemId)
      const all = await db.getAllFavorites()
      const maxSortOrder = all.reduce((max, f) => Math.max(max, f.sortOrder), 0)

      const favorite: StoredFavorite = {
        id,
        collectionId,
        itemId,
        type,
        createdAt: Date.now(),
        sortOrder: maxSortOrder,
      }

      set((state) => {
        const newFavorites = new Map(state.favorites)
        newFavorites.set(id, favorite)
        return { favorites: newFavorites }
      })
    } catch (error) {
      console.error('Failed to add favorite:', error)
    }
  },

  /**
   * Remove an item from favorites.
   */
  removeFavorite: async (collectionId, itemId, type) => {
    try {
      await db.removeFavorite(collectionId, type, itemId)

      const id = db.generateFavoriteId(collectionId, type, itemId)

      set((state) => {
        const newFavorites = new Map(state.favorites)
        newFavorites.delete(id)
        return { favorites: newFavorites }
      })
    } catch (error) {
      console.error('Failed to remove favorite:', error)
    }
  },

  /**
   * Toggle favorite status.
   */
  toggleFavorite: async (collectionId, itemId, type) => {
    const { isFavorite, addFavorite, removeFavorite } = get()
    if (isFavorite(collectionId, itemId, type)) {
      await removeFavorite(collectionId, itemId, type)
    } else {
      await addFavorite(collectionId, itemId, type)
    }
  },

  /**
   * Check if an item is favorited.
   */
  isFavorite: (collectionId, itemId, type) => {
    const id = db.generateFavoriteId(collectionId, type, itemId)
    return get().favorites.has(id)
  },

  /**
   * Get all favorites sorted by sortOrder.
   */
  getFavorites: () => {
    const favorites = Array.from(get().favorites.values())
    return favorites.sort((a, b) => a.sortOrder - b.sortOrder)
  },

  /**
   * Remove all favorites for a collection.
   */
  removeByCollection: async (collectionId) => {
    try {
      await db.removeFavoritesByCollection(collectionId)

      set((state) => {
        const newFavorites = new Map(state.favorites)
        for (const [id, fav] of newFavorites) {
          if (fav.collectionId === collectionId) {
            newFavorites.delete(id)
          }
        }
        return { favorites: newFavorites }
      })
    } catch (error) {
      console.error('Failed to remove favorites for collection:', error)
    }
  },
}))
