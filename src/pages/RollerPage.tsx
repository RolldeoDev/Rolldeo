/**
 * RollerPage
 *
 * Split-panel layout for browsing tables/templates and rolling on them.
 * Left panel: Collection accordion with search and filtering
 * Right panel: Selected item info, roll result, and history
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
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
import { RollMultipleModal } from '@/components/roller/RollMultipleModal'
import { ViewDetailsModal } from '@/components/roller/ViewDetailsModal'

export function RollerPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialCollectionId = searchParams.get('collection') || undefined

  // Ensure collections are loaded
  useCollections()

  // Expand the collection from URL on mount
  const setExpandedCollectionId = useUIStore((state) => state.setExpandedCollectionId)
  const setEditorActiveTab = useUIStore((state) => state.setEditorActiveTab)
  const setEditorSelectedItemId = useUIStore((state) => state.setEditorSelectedItemId)
  const setEditorLastExplicitItemId = useUIStore((state) => state.setEditorLastExplicitItemId)

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

  // Modal state for Roll Multiple
  const [rollMultipleModal, setRollMultipleModal] = useState<{
    item: BrowserItem
    collectionId: string
  } | null>(null)

  // Modal state for View Details
  const [viewDetailsModal, setViewDetailsModal] = useState<{
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

  // Handle Edit - navigate to editor with item selected
  const handleEditItem = useCallback(
    (item: BrowserItem, collectionId: string) => {
      // Set the editor tab and selected item before navigating
      setEditorActiveTab(item.type === 'template' ? 'templates' : 'tables')
      setEditorSelectedItemId(item.id)
      // Also set the "last explicit" item ID which controls expansion and scroll-to behavior
      setEditorLastExplicitItemId(item.id)
      // Navigate to the editor page for this collection
      navigate(`/editor/${collectionId}`)
    },
    [navigate, setEditorActiveTab, setEditorSelectedItemId, setEditorLastExplicitItemId]
  )

  // Handle Copy Result - roll and copy to clipboard
  const handleCopyResult = useCallback(
    async (item: BrowserItem, collectionId: string) => {
      // First select the item
      setSelectedItemState({ item, collectionId })

      // Roll and get result
      let rollResult
      if (item.type === 'template') {
        rollResult = await rollOnTemplate(collectionId, item.id)
      } else {
        rollResult = await rollOnTable(collectionId, item.id)
      }

      // Copy to clipboard if we got a result
      if (rollResult?.text) {
        try {
          await navigator.clipboard.writeText(rollResult.text)
        } catch (err) {
          console.error('Failed to copy to clipboard:', err)
        }
      }
    },
    [rollOnTable, rollOnTemplate]
  )

  // Handle Roll Multiple - open modal
  const handleRollMultiple = useCallback(
    (item: BrowserItem, collectionId: string) => {
      setRollMultipleModal({ item, collectionId })
    },
    []
  )

  // Handle View Details - open modal
  const handleViewDetails = useCallback(
    (item: BrowserItem, collectionId: string) => {
      setViewDetailsModal({ item, collectionId })
    },
    []
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
            onEditItem={handleEditItem}
            onCopyResult={handleCopyResult}
            onRollMultiple={handleRollMultiple}
            onViewDetails={handleViewDetails}
            onMobileClose={onMobileClose}
          />
        )}
        rightPanel={
          <ResultsPanel
            selectedItem={selectedItem}
            collectionId={selectedItemState?.collectionId ?? null}
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

      {/* Roll Multiple Modal */}
      {rollMultipleModal && (
        <RollMultipleModal
          item={rollMultipleModal.item}
          collectionId={rollMultipleModal.collectionId}
          onClose={() => setRollMultipleModal(null)}
          onRoll={async (count) => {
            const { item, collectionId } = rollMultipleModal
            const results: string[] = []
            for (let i = 0; i < count; i++) {
              let rollResult
              if (item.type === 'template') {
                rollResult = await rollOnTemplate(collectionId, item.id)
              } else {
                rollResult = await rollOnTable(collectionId, item.id)
              }
              if (rollResult?.text) results.push(rollResult.text)
            }
            return results
          }}
        />
      )}

      {/* View Details Modal */}
      {viewDetailsModal && (
        <ViewDetailsModal
          item={viewDetailsModal.item}
          collectionId={viewDetailsModal.collectionId}
          onClose={() => setViewDetailsModal(null)}
        />
      )}
    </div>
  )
}
