/**
 * useRoller Hook
 *
 * Provides convenient access to rolling functionality.
 */

import { useEffect, useCallback, useMemo } from 'react'
import { useRollStore } from '../stores/rollStore'
import { useCollectionStore, type CollectionMeta } from '../stores/collectionStore'
import { useUIStore } from '../stores/uiStore'
import type { TableInfo, TemplateInfo } from '../engine/core'
import type { RollResult } from '../engine/types'
import type { StoredRoll } from '../services/db'

export interface UseRollerReturn {
  // Selection
  selectedCollectionId: string | null
  selectedTableId: string | null
  selectedTemplateId: string | null

  // Available options
  collections: CollectionMeta[]
  tables: TableInfo[]
  templates: TemplateInfo[]

  // Roll state
  currentResult: RollResult | null
  isRolling: boolean
  rollError: string | null

  // History
  history: StoredRoll[]
  pinnedHistory: StoredRoll[]

  // Selection actions
  selectCollection: (id: string | null) => void
  selectTable: (id: string | null) => void
  selectTemplate: (id: string | null) => void

  // Roll actions
  roll: () => Promise<RollResult | null>
  rollOnTable: (collectionId: string, tableId: string) => Promise<RollResult>
  rollOnTemplate: (collectionId: string, templateId: string) => Promise<RollResult>
  clearResult: () => void

  // History actions
  pinResult: (id: number, pinned: boolean) => Promise<void>
  deleteHistoryItem: (id: number) => Promise<void>
  clearHistory: (keepPinned?: boolean) => Promise<void>

  // Computed
  canRoll: boolean
  selectedItemName: string | null
}

/**
 * Hook for rolling on tables and managing roll history.
 *
 * @param initialCollectionId Optional initial collection ID (e.g., from URL params)
 * @param initialTableId Optional initial table ID (e.g., from URL params)
 */
export function useRoller(
  initialCollectionId?: string,
  initialTableId?: string
): UseRollerReturn {
  const {
    selectedCollectionId,
    selectedTableId,
    selectedTemplateId,
    currentResult,
    isRolling,
    rollError,
    history,
    selectCollection,
    selectTable,
    selectTemplate,
    roll,
    rollOnTable,
    rollOnTemplate,
    clearResult,
    loadHistory,
    pinResult,
    deleteHistoryItem,
    clearHistory,
  } = useRollStore()

  // Subscribe to collections state (not functions) to trigger re-renders when data changes
  const storeCollections = useCollectionStore((state) => state.collections)
  const isInitialized = useCollectionStore((state) => state.isInitialized)

  const { showHiddenTables } = useUIStore()

  // Initialize from URL params - only run when params change
  useEffect(() => {
    if (initialCollectionId && initialCollectionId !== selectedCollectionId) {
      selectCollection(initialCollectionId)
    }
  }, [initialCollectionId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialTableId && initialTableId !== selectedTableId) {
      selectTable(initialTableId)
    }
  }, [initialTableId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Get available collections (excluding hidden ones)
  // Use storeCollections as dependency (stable Map reference) instead of function
  const collections = useMemo(
    () => Array.from(storeCollections.values()).filter((c) => !c.hiddenFromUI),
    [storeCollections]
  )

  // Get tables for selected collection
  // Use getState() to call function inside useMemo, storeCollections triggers refresh
  const tables = useMemo(() => {
    if (!selectedCollectionId) return []
    const allTables = useCollectionStore.getState().getTableList(selectedCollectionId)
    return showHiddenTables ? allTables : allTables.filter((t) => !t.hidden)
  }, [selectedCollectionId, showHiddenTables, storeCollections])

  // Get templates for selected collection
  const templates = useMemo(() => {
    if (!selectedCollectionId) return []
    return useCollectionStore.getState().getTemplateList(selectedCollectionId)
  }, [selectedCollectionId, storeCollections])

  // Compute if we can roll
  const canRoll = useMemo(() => {
    return (
      isInitialized &&
      selectedCollectionId !== null &&
      (selectedTableId !== null || selectedTemplateId !== null)
    )
  }, [isInitialized, selectedCollectionId, selectedTableId, selectedTemplateId])

  // Get the name of the selected item
  const selectedItemName = useMemo(() => {
    if (selectedTemplateId) {
      const template = templates.find((t) => t.id === selectedTemplateId)
      return template?.name || selectedTemplateId
    }
    if (selectedTableId) {
      const table = tables.find((t) => t.id === selectedTableId)
      return table?.name || selectedTableId
    }
    return null
  }, [selectedTableId, selectedTemplateId, tables, templates])

  // Get pinned history items
  const pinnedHistory = useMemo(() => {
    return history.filter((r) => r.pinned)
  }, [history])

  // Wrapped roll function
  const handleRoll = useCallback(async () => {
    if (!canRoll) return null
    return roll()
  }, [canRoll, roll])

  return {
    // Selection
    selectedCollectionId,
    selectedTableId,
    selectedTemplateId,

    // Options
    collections,
    tables,
    templates,

    // Roll state
    currentResult,
    isRolling,
    rollError,

    // History
    history,
    pinnedHistory,

    // Selection actions
    selectCollection,
    selectTable,
    selectTemplate,

    // Roll actions
    roll: handleRoll,
    rollOnTable,
    rollOnTemplate,
    clearResult,

    // History actions
    pinResult,
    deleteHistoryItem,
    clearHistory,

    // Computed
    canRoll,
    selectedItemName,
  }
}
