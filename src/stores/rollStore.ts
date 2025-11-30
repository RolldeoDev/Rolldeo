/**
 * Roll Store
 *
 * Manages rolling state, current selection, and roll history.
 * Persists selection to localStorage for convenience.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RollResult } from '../engine/types'
import { useCollectionStore } from './collectionStore'
import * as db from '../services/db'
import type { StoredRoll } from '../services/db'

// ============================================================================
// Types
// ============================================================================

interface RollState {
  // Selection
  selectedCollectionId: string | null
  selectedTableId: string | null
  selectedTemplateId: string | null

  // Roll state
  currentResult: RollResult | null
  isRolling: boolean
  rollError: string | null

  // Trace mode
  traceEnabled: boolean

  // History
  history: StoredRoll[]
  historyLoaded: boolean

  // Actions
  selectCollection: (id: string | null) => void
  selectTable: (id: string | null) => void
  selectTemplate: (id: string | null) => void

  setTraceEnabled: (enabled: boolean) => void

  roll: () => Promise<RollResult | null>
  rollOnTable: (collectionId: string, tableId: string) => Promise<RollResult>
  rollOnTemplate: (collectionId: string, templateId: string) => Promise<RollResult>
  clearResult: () => void

  loadHistory: () => Promise<void>
  pinResult: (id: number, pinned: boolean) => Promise<void>
  deleteHistoryItem: (id: number) => Promise<void>
  clearHistory: (keepPinned?: boolean) => Promise<void>
}

// ============================================================================
// Store
// ============================================================================

export const useRollStore = create<RollState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedCollectionId: null,
      selectedTableId: null,
      selectedTemplateId: null,
      currentResult: null,
      isRolling: false,
      rollError: null,
      traceEnabled: false,
      history: [],
      historyLoaded: false,

      // ========================================================================
      // Selection Actions
      // ========================================================================

      selectCollection: (id) => {
        set({
          selectedCollectionId: id,
          selectedTableId: null,
          selectedTemplateId: null,
          currentResult: null,
          rollError: null,
        })
      },

      selectTable: (id) => {
        set({
          selectedTableId: id,
          selectedTemplateId: null, // Clear template when selecting table
          currentResult: null,
          rollError: null,
        })
      },

      selectTemplate: (id) => {
        set({
          selectedTemplateId: id,
          selectedTableId: null, // Clear table when selecting template
          currentResult: null,
          rollError: null,
        })
      },

      setTraceEnabled: (enabled) => {
        set({ traceEnabled: enabled })
      },

      // ========================================================================
      // Roll Actions
      // ========================================================================

      /**
       * Roll using current selection.
       */
      roll: async () => {
        const { selectedCollectionId, selectedTableId, selectedTemplateId } = get()

        if (!selectedCollectionId) {
          set({ rollError: 'No collection selected' })
          return null
        }

        if (selectedTemplateId) {
          return get().rollOnTemplate(selectedCollectionId, selectedTemplateId)
        }

        if (selectedTableId) {
          return get().rollOnTable(selectedCollectionId, selectedTableId)
        }

        set({ rollError: 'No table or template selected' })
        return null
      },

      /**
       * Roll on a specific table.
       */
      rollOnTable: async (collectionId, tableId) => {
        set({ isRolling: true, rollError: null })

        try {
          const engine = useCollectionStore.getState().engine
          const { traceEnabled } = get()
          const result = engine.roll(tableId, collectionId, { enableTrace: traceEnabled })

          // Save to history
          const rollId = await db.saveRoll({
            result,
            collectionId,
            tableId,
            pinned: false,
            timestamp: Date.now(),
          })

          // Create stored roll
          const storedRoll: StoredRoll = {
            id: rollId,
            result,
            collectionId,
            tableId,
            pinned: false,
            timestamp: Date.now(),
          }

          // Update state
          set((state) => ({
            currentResult: result,
            isRolling: false,
            history: [storedRoll, ...state.history].slice(0, 100),
          }))

          return result
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Roll failed'
          set({ isRolling: false, rollError: message })
          throw error
        }
      },

      /**
       * Roll on a specific template.
       */
      rollOnTemplate: async (collectionId, templateId) => {
        set({ isRolling: true, rollError: null })

        try {
          const engine = useCollectionStore.getState().engine
          const { traceEnabled } = get()
          const result = engine.rollTemplate(templateId, collectionId, { enableTrace: traceEnabled })

          // Save to history
          const rollId = await db.saveRoll({
            result,
            collectionId,
            templateId,
            pinned: false,
            timestamp: Date.now(),
          })

          // Create stored roll
          const storedRoll: StoredRoll = {
            id: rollId,
            result,
            collectionId,
            templateId,
            pinned: false,
            timestamp: Date.now(),
          }

          // Update state
          set((state) => ({
            currentResult: result,
            isRolling: false,
            history: [storedRoll, ...state.history].slice(0, 100),
          }))

          return result
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Roll failed'
          set({ isRolling: false, rollError: message })
          throw error
        }
      },

      /**
       * Clear current result.
       */
      clearResult: () => {
        set({ currentResult: null, rollError: null })
      },

      // ========================================================================
      // History Actions
      // ========================================================================

      /**
       * Load history from database.
       */
      loadHistory: async () => {
        if (get().historyLoaded) return

        try {
          const history = await db.getRollHistory(100)
          set({ history, historyLoaded: true })
        } catch (error) {
          console.error('Failed to load history:', error)
        }
      },

      /**
       * Pin or unpin a history item.
       */
      pinResult: async (id, pinned) => {
        await db.pinRoll(id, pinned)
        set((state) => ({
          history: state.history.map((r) => (r.id === id ? { ...r, pinned } : r)),
        }))
      },

      /**
       * Delete a specific history item.
       */
      deleteHistoryItem: async (id) => {
        await db.deleteRoll(id)
        set((state) => ({
          history: state.history.filter((r) => r.id !== id),
        }))
      },

      /**
       * Clear all history.
       */
      clearHistory: async (keepPinned = true) => {
        await db.clearHistory(keepPinned)
        if (keepPinned) {
          set((state) => ({
            history: state.history.filter((r) => r.pinned),
          }))
        } else {
          set({ history: [] })
        }
      },
    }),
    {
      name: 'roll-store',
      // Only persist selection, not results or history
      partialize: (state) => ({
        selectedCollectionId: state.selectedCollectionId,
        selectedTableId: state.selectedTableId,
        selectedTemplateId: state.selectedTemplateId,
      }),
    }
  )
)

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format timestamp for display.
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // Less than a minute
  if (diff < 60000) {
    return 'Just now'
  }

  // Less than an hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes}m ago`
  }

  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}h ago`
  }

  // Same year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // Different year
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
