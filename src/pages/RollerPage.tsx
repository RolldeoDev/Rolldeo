/**
 * RollerPage
 *
 * Split-panel layout for browsing tables/templates and rolling on them.
 * Left panel: Collection accordion with search and filtering
 * Right panel: Selected item info, roll result, and history
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useSearchParams, useNavigate, useParams } from 'react-router-dom'
import { useRoller } from '@/hooks/useRoller'
import { useCollections } from '@/hooks/useCollections'
import { useCollectionStore } from '@/stores/collectionStore'
import { useUIStore } from '@/stores/uiStore'
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks'
import { SEO } from '@/components/common'
import { PAGE_SEO } from '@/lib/seo'
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
  const { collectionId: urlCollectionId, tableId: urlItemId } = useParams()
  const initialCollectionId = urlCollectionId || searchParams.get('collection') || undefined

  // Track if we've already handled URL-based selection
  const hasHandledUrlSelection = useRef(false)

  // Ensure collections are loaded
  useCollections()

  // Expand the collection from URL on mount
  const setExpandedCollectionId = useUIStore((state) => state.setExpandedCollectionId)
  const setEditorActiveTab = useUIStore((state) => state.setEditorActiveTab)
  const setEditorSelectedItemId = useUIStore((state) => state.setEditorSelectedItemId)
  const setEditorLastExplicitItemId = useUIStore((state) => state.setEditorLastExplicitItemId)

  // Track selected item and its collection
  const [selectedItemState, setSelectedItemState] = useState<{
    item: BrowserItem
    collectionId: string
  } | null>(null)

  useEffect(() => {
    if (initialCollectionId) {
      setExpandedCollectionId(initialCollectionId)
    }
  }, [initialCollectionId, setExpandedCollectionId])

  // Handle URL-based item selection (from CommandPalette or direct links)
  useEffect(() => {
    // Skip if no URL params or already handled
    if (!urlCollectionId || !urlItemId || hasHandledUrlSelection.current) return

    const { getTableList, getTemplateList } = useCollectionStore.getState()

    // Try to find as a table first
    const tables = getTableList(urlCollectionId)
    const table = tables.find((t) => t.id === urlItemId)
    if (table) {
      const item: BrowserItem = {
        id: table.id,
        name: table.name,
        type: 'table',
        tableType: table.type,
        description: table.description,
        tags: table.tags,
        hidden: table.hidden,
        entryCount: table.entryCount,
        resultType: table.resultType,
      }
      setSelectedItemState({ item, collectionId: urlCollectionId })
      hasHandledUrlSelection.current = true
      return
    }

    // Try as a template
    const templates = getTemplateList(urlCollectionId)
    const template = templates.find((t) => t.id === urlItemId)
    if (template) {
      const item: BrowserItem = {
        id: template.id,
        name: template.name,
        type: 'template',
        description: template.description,
        tags: template.tags,
        resultType: template.resultType,
      }
      setSelectedItemState({ item, collectionId: urlCollectionId })
      hasHandledUrlSelection.current = true
    }
  }, [urlCollectionId, urlItemId])

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

  // Subscribe to collections Map to trigger re-renders when data changes
  const collectionsMap = useCollectionStore((state) => state.collections)

  // Build the selected item with full details - use getState() to access functions
  const selectedItem = useMemo((): BrowserItem | null => {
    if (!selectedItemState) return null

    const { item, collectionId } = selectedItemState
    const { getTableList, getTemplateList } = useCollectionStore.getState()

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
  }, [selectedItemState, collectionsMap])

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
    <>
      <SEO {...PAGE_SEO.roll} />
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
    </>
  )
}
