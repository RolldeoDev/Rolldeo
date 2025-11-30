/**
 * RollerPage
 *
 * Split-panel layout for browsing tables/templates and rolling on them.
 * Left panel: Collection accordion with search and filtering
 * Right panel: Selected item info, roll result, and history
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useRoller } from '@/hooks/useRoller'
import { useCollections } from '@/hooks/useCollections'
import { useCollectionStore } from '@/stores/collectionStore'
import { useUIStore } from '@/stores/uiStore'
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import {
  SplitPanelLayout,
  BrowserPanel,
  ResultsPanel,
} from '@/components/roller'

export function RollerPage() {
  const [searchParams] = useSearchParams()
  const initialCollectionId = searchParams.get('collection') || undefined

  // Ensure collections are loaded
  useCollections()

  // Expand the collection from URL on mount
  const setExpandedCollectionId = useUIStore((state) => state.setExpandedCollectionId)
  useEffect(() => {
    if (initialCollectionId) {
      setExpandedCollectionId(initialCollectionId)
    }
  }, [initialCollectionId, setExpandedCollectionId])

  // Track selected item and its collection
  const [selectedItemState, setSelectedItemState] = useState<{
    item: BrowserItem
    collectionId: string
  } | null>(null)

  const {
    currentResult,
    isRolling,
    rollError,
    history,
    rollOnTable,
    rollOnTemplate,
    pinResult,
    deleteHistoryItem,
    clearHistory,
  } = useRoller(initialCollectionId)

  // Get table/template info for the selected item
  const getTableList = useCollectionStore((state) => state.getTableList)
  const getTemplateList = useCollectionStore((state) => state.getTemplateList)

  // Build the selected item with full details
  const selectedItem = useMemo((): BrowserItem | null => {
    if (!selectedItemState) return null

    const { item, collectionId } = selectedItemState

    if (item.type === 'template') {
      const templates = getTemplateList(collectionId)
      const template = templates.find((t) => t.id === item.id)
      if (template) {
        return {
          id: template.id,
          name: template.name,
          type: 'template',
          description: template.description,
          tags: template.tags,
        }
      }
    } else {
      const tables = getTableList(collectionId)
      const table = tables.find((t) => t.id === item.id)
      if (table) {
        return {
          id: table.id,
          name: table.name,
          type: 'table',
          tableType: table.type,
          description: table.description,
          tags: table.tags,
          hidden: table.hidden,
          entryCount: table.entryCount,
        }
      }
    }

    return item
  }, [selectedItemState, getTableList, getTemplateList])

  // Can roll if we have a selected item
  const canRoll = selectedItemState !== null

  // Handle rolling
  const handleRoll = useCallback(async () => {
    if (!canRoll || isRolling || !selectedItemState) return

    const { item, collectionId } = selectedItemState

    if (item.type === 'template') {
      await rollOnTemplate(collectionId, item.id)
    } else {
      await rollOnTable(collectionId, item.id)
    }
  }, [canRoll, isRolling, selectedItemState, rollOnTable, rollOnTemplate])

  // Handle selecting an item from the browser
  const handleSelectItem = useCallback(
    (item: BrowserItem, collectionId: string) => {
      setSelectedItemState({ item, collectionId })
    },
    []
  )

  // Handle rolling on an item directly from the browser
  const handleRollItem = useCallback(
    async (item: BrowserItem, collectionId: string) => {
      // First select the item
      setSelectedItemState({ item, collectionId })

      // Then roll on it
      if (item.type === 'template') {
        await rollOnTemplate(collectionId, item.id)
      } else {
        await rollOnTable(collectionId, item.id)
      }
    },
    [rollOnTable, rollOnTemplate]
  )

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      {
        key: 'Space',
        handler: () => handleRoll(),
        description: 'Roll',
      },
      {
        key: 'Enter',
        handler: () => handleRoll(),
        description: 'Roll',
      },
    ],
    [handleRoll]
  )

  useKeyboardShortcuts({ shortcuts })

  // Compute selected item ID for highlighting
  const selectedItemId = selectedItemState?.item.id || null

  return (
    <div className="h-[calc(100vh-4rem)]">
      <SplitPanelLayout
        leftPanel={({ onMobileClose }) => (
          <BrowserPanel
            selectedItemId={selectedItemId}
            onSelectItem={handleSelectItem}
            onRollItem={handleRollItem}
            onMobileClose={onMobileClose}
          />
        )}
        rightPanel={
          <ResultsPanel
            selectedItem={selectedItem}
            currentResult={currentResult}
            isRolling={isRolling}
            rollError={rollError}
            canRoll={canRoll}
            history={history}
            onRoll={handleRoll}
            onPin={pinResult}
            onDelete={deleteHistoryItem}
            onClearHistory={clearHistory}
          />
        }
      />
    </div>
  )
}
