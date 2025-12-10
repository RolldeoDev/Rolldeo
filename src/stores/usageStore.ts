/**
 * Usage Store
 *
 * Tracks usage statistics for tables and templates.
 * Records roll counts and timestamps for Recent/Popular sections.
 */

import { create } from 'zustand'
import * as db from '../services/db'
import type { UsageStats } from '../services/db'

// ============================================================================
// Types
// ============================================================================

interface UsageState {
  // State
  stats: Map<string, UsageStats>
  isLoaded: boolean
  loadError: string | null

  // Computed
  recentItems: UsageStats[]
  popularItems: UsageStats[]

  // Actions
  loadStats: () => Promise<void>
  recordUsage: (
    collectionId: string,
    type: 'table' | 'template',
    itemId: string
  ) => Promise<void>
  clearStats: () => Promise<void>
  removeByCollection: (collectionId: string) => Promise<void>
}

// ============================================================================
// Store
// ============================================================================

export const useUsageStore = create<UsageState>()((set, get) => ({
  // Initial state
  stats: new Map(),
  isLoaded: false,
  loadError: null,
  recentItems: [],
  popularItems: [],

  // ========================================================================
  // Actions
  // ========================================================================

  /**
   * Load all usage stats from database.
   */
  loadStats: async () => {
    if (get().isLoaded) return

    try {
      const [all, recent, popular] = await Promise.all([
        db.getAllUsageStats(),
        db.getRecentUsage(10),
        db.getPopularUsage(10),
      ])

      const statsMap = new Map<string, UsageStats>()
      for (const stat of all) {
        statsMap.set(stat.id, stat)
      }

      set({
        stats: statsMap,
        recentItems: recent,
        popularItems: popular,
        isLoaded: true,
        loadError: null,
      })
    } catch (error) {
      console.error('Failed to load usage stats:', error)
      set({
        isLoaded: true,
        loadError: error instanceof Error ? error.message : 'Failed to load usage stats',
      })
    }
  },

  /**
   * Record usage of a table or template.
   * Updates both database and in-memory state.
   */
  recordUsage: async (collectionId, type, itemId) => {
    try {
      // Update database
      await db.recordUsage(collectionId, type, itemId)

      // Refresh recent and popular lists
      const [recent, popular] = await Promise.all([
        db.getRecentUsage(10),
        db.getPopularUsage(10),
      ])

      // Update the specific stat in memory
      const id = db.generateUsageStatsId(collectionId, type, itemId)
      const updatedStat = await db.getUsageStats(collectionId, type, itemId)

      set((state) => {
        const newStats = new Map(state.stats)
        if (updatedStat) {
          newStats.set(id, updatedStat)
        }
        return {
          stats: newStats,
          recentItems: recent,
          popularItems: popular,
        }
      })
    } catch (error) {
      console.error('Failed to record usage:', error)
    }
  },

  /**
   * Clear all usage statistics.
   */
  clearStats: async () => {
    try {
      await db.clearUsageStats()
      set({
        stats: new Map(),
        recentItems: [],
        popularItems: [],
      })
    } catch (error) {
      console.error('Failed to clear usage stats:', error)
    }
  },

  /**
   * Remove usage stats for a specific collection.
   */
  removeByCollection: async (collectionId) => {
    try {
      await db.removeUsageStatsByCollection(collectionId)

      // Refresh all lists
      const [all, recent, popular] = await Promise.all([
        db.getAllUsageStats(),
        db.getRecentUsage(10),
        db.getPopularUsage(10),
      ])

      const statsMap = new Map<string, UsageStats>()
      for (const stat of all) {
        statsMap.set(stat.id, stat)
      }

      set({
        stats: statsMap,
        recentItems: recent,
        popularItems: popular,
      })
    } catch (error) {
      console.error('Failed to remove usage stats for collection:', error)
    }
  },
}))

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get usage stats for a specific item.
 */
export function getItemUsage(
  collectionId: string,
  type: 'table' | 'template',
  itemId: string
): UsageStats | undefined {
  const id = db.generateUsageStatsId(collectionId, type, itemId)
  return useUsageStore.getState().stats.get(id)
}
