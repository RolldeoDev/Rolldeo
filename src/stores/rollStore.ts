/**
 * Roll Store
 *
 * Manages rolling state, current selection, and roll history.
 * Persists selection to localStorage for convenience.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { InputError, resolveInputs } from '../engine/core/inputs'
import type { InputValue, RollResult } from '../engine/types'
import { useCollectionStore } from './collectionStore'
import { useUsageStore } from './usageStore'
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

  inputValues: Record<string, InputValue>
  setInputValue: (name: string, value: InputValue | undefined) => void
  getInputErrors: (collectionId: string) => Record<string, string>
  reconcileInputs: () => void

  // Roll state
  currentResult: RollResult | null
  currentRoll: StoredRoll | null
  currentItemName: string | null
  isRolling: boolean
  rollError: string | null

  // Trace mode
  traceEnabled: boolean

  // History
  history: StoredRoll[]
  historyLoaded: boolean
  historyError: string | null

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

// Serialize history mutations so delayed writes cannot race with clear/pin/load.
let historyQueue: Promise<unknown> = Promise.resolve()
let latestRequest = 0
let pendingRolls = 0
function withHistory<T>(operation: () => Promise<T>): Promise<T> {
  const next = historyQueue.then(operation, operation)
  historyQueue = next.catch(() => undefined)
  return next
}
async function retainedHistory(): Promise<StoredRoll[]> {
  const { historyLimit } = await db.getPreferences()
  const limit = Number.isFinite(historyLimit) ? Math.max(0, Math.floor(historyLimit)) : 100
  await db.trimHistory(limit)
  return db.getRetainedRollHistory(limit)
}


export const useRollStore = create<RollState>()(
  persist(
    (set, get) => {
      const performRoll = async (collectionId: string, itemId: string, type: 'table' | 'template'): Promise<RollResult> => {
        const request = ++latestRequest
        pendingRolls++
        set({ isRolling: true, rollError: null })
        try {
          const { engine } = useCollectionStore.getState()
          const name = type === 'table'
            ? engine.listTables(collectionId, true).find(item => item.id === itemId)?.name
            : engine.listTemplates(collectionId).find(item => item.id === itemId)?.name
          const inputs = collectionId === get().selectedCollectionId ? get().inputValues : {}
          const result = type === 'table'
            ? engine.roll(itemId, collectionId, { enableTrace: get().traceEnabled, inputs })
            : engine.rollTemplate(itemId, collectionId, { enableTrace: get().traceEnabled, inputs })
          const record: StoredRoll = { result, collectionId, pinned: false, timestamp: Date.now(),
            ...(type === 'table' ? { tableId: itemId } : { templateId: itemId }) }
          set({ currentResult: result, currentRoll: record, currentItemName: name || itemId })
          await withHistory(async () => {
            record.id = await db.saveRoll(record)
            const history = await retainedHistory()
            set({ history, historyLoaded: true, historyError: null,
              ...(request === latestRequest ? { currentRoll: { ...record } } : {}) })
          })
          useUsageStore.getState().recordUsage(collectionId, type, itemId)
          return result
        } catch (error) {
          if (request === latestRequest) set({ rollError: error instanceof Error ? error.message : 'Roll failed' })
          throw error
        } finally {
          pendingRolls--
          set({ isRolling: pendingRolls > 0 })
        }
      }
      return ({
      // Initial state
      selectedCollectionId: null,
      selectedTableId: null,
      selectedTemplateId: null,
      inputValues: {},
      setInputValue: (name, value) => {
        const next = { ...get().inputValues }
        if (value === undefined) delete next[name]
        else next[name] = value
        set({ inputValues: next, rollError: null })
      },
      reconcileInputs: () => {
        const { selectedCollectionId, inputValues } = get()
        const definitions = selectedCollectionId
          ? useCollectionStore.getState().engine.getCollection(selectedCollectionId)?.document.inputs ?? {}
          : {}
        const retained = Object.fromEntries(Object.entries(inputValues).filter(([name]) => Object.prototype.hasOwnProperty.call(definitions, name)))
        if (Object.keys(retained).length !== Object.keys(inputValues).length) set({ inputValues: retained, rollError: null })
      },
      getInputErrors: (collectionId) => {
        try {
          resolveInputs(useCollectionStore.getState().engine.getCollection(collectionId)?.document.inputs, collectionId === get().selectedCollectionId ? get().inputValues : {})
          return {}
        } catch (error) {
          return error instanceof InputError ? error.errors : { inputs: String(error) }
        }
      },
      currentResult: null,
      currentRoll: null,
      currentItemName: null,
      isRolling: false,
      rollError: null,
      traceEnabled: false,
      history: [],
      historyLoaded: false,
      historyError: null,

      // ========================================================================
      // Selection Actions
      // ========================================================================

      selectCollection: (id) => {
        if (id === get().selectedCollectionId) get().reconcileInputs()
        set({
          selectedCollectionId: id,
          inputValues: id === get().selectedCollectionId ? get().inputValues : {},
          selectedTableId: null,
          selectedTemplateId: null,
          rollError: null,
        })
      },

      selectTable: (id) => {
        set({
          selectedTableId: id,
          selectedTemplateId: null, // Clear template when selecting table
          rollError: null,
        })
      },

      selectTemplate: (id) => {
        set({
          selectedTemplateId: id,
          selectedTableId: null, // Clear table when selecting template
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
      rollOnTable: (collectionId, tableId) => performRoll(collectionId, tableId, 'table'),

      rollOnTemplate: (collectionId, templateId) => performRoll(collectionId, templateId, 'template'),

      /**
       * Clear current result.
       */
      clearResult: () => {
        latestRequest++
        set({ currentResult: null, currentRoll: null, currentItemName: null, rollError: null })
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
          const history = await withHistory(retainedHistory)
          set({ history, historyLoaded: true, historyError: null })
        } catch (error) {
          console.error('Failed to load history:', error)
          set({
            historyLoaded: true,
            historyError: error instanceof Error ? error.message : 'Failed to load roll history',
          })
        }
      },

      /**
       * Pin or unpin a history item.
       */
      pinResult: async (id, pinned) => {
        try {
          await withHistory(async () => {
            await db.pinRoll(id, pinned)
            const history = await retainedHistory()
            set((state) => ({ history, historyError: null,
              currentRoll: state.currentRoll?.id === id ? { ...state.currentRoll, pinned } : state.currentRoll }))
          })
        } catch (error) {
          set({ historyError: error instanceof Error ? error.message : 'Failed to pin result' })
        }
      },

      deleteHistoryItem: async (id) => {
        try {
          await withHistory(async () => {
            await db.deleteRoll(id)
            set((state) => ({ history: state.history.filter(r => r.id !== id), historyError: null,
              ...(state.currentRoll?.id === id ? { currentRoll: null, currentResult: null, currentItemName: null } : {}) }))
          })
        } catch (error) {
          set({ historyError: error instanceof Error ? error.message : 'Failed to delete history item' })
        }
      },

      clearHistory: async (keepPinned = true) => {
        const sourceToClear = get().currentRoll?.result
        await withHistory(async () => {
          await db.clearHistory(keepPinned)
          set((state) => ({ history: keepPinned ? state.history.filter(r => r.pinned) : [],
            ...(state.currentRoll?.result === sourceToClear && (!keepPinned || !state.currentRoll?.pinned)
              ? { currentRoll: null, currentResult: null, currentItemName: null } : {}) }))
        })
      },
      })
    },
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

// Editing or re-importing the selected collection can remove or rename declarations.
// Reconcile UI-owned values when the collection store publishes its new document;
// the engine API continues to reject unknown explicitly supplied keys.
const stopInputReconciliation = useCollectionStore.subscribe((state, previous) => {
  if (state.collections !== previous.collections || state.engine !== previous.engine) {
    useRollStore.getState().reconcileInputs()
  }
})
if (import.meta.hot) import.meta.hot.dispose(stopInputReconciliation)

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
