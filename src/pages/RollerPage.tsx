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
import { browserItemKey, browserItemFromRoute } from '@/lib/browserIdentity'
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
  const urlKind = searchParams.get('kind')

  // Track if we've already handled URL-based selection
  const handledUrlSelection = useRef<string | null>(null)
  const isInitialized = useCollectionStore(state => state.isInitialized)
  const collectionsMap = useCollectionStore(state => state.collections)

  // Ensure collections are loaded
  useCollections()

  // Expand the collection from URL on mount
  const setExpandedCollectionId = useUIStore((state) => state.setExpandedCollectionId)
  const setBrowserActiveTab = useUIStore((state) => state.setBrowserActiveTab)
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
    if (!urlCollectionId || !urlItemId) {
      handledUrlSelection.current = null
      return
    }
    const urlKey = JSON.stringify([urlCollectionId, urlKind, urlItemId])
    if (!isInitialized || handledUrlSelection.current === urlKey) return
    if (!collectionsMap.has(urlCollectionId)) {
      setSelectedItemState(null)
      return
    }

    const { getTableList, getTemplateList } = useCollectionStore.getState()

    const item = browserItemFromRoute(getTableList(urlCollectionId), getTemplateList(urlCollectionId), urlItemId, urlKind)
    if (item) {
      setSelectedItemState({ item, collectionId: urlCollectionId })
      setBrowserActiveTab(item.type === 'template' ? 'templates' : 'tables')
      handledUrlSelection.current = urlKey
    } else {
      setSelectedItemState(null)
    }
  }, [urlCollectionId, urlItemId, urlKind, isInitialized, collectionsMap, setBrowserActiveTab])

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
    currentRoll,
    currentItemName,
    isRolling,
    rollError,
    history,
    rollOnTable,
    rollOnTemplate,
    pinResult,
    deleteHistoryItem,
    clearHistory,
  } = useRoller(initialCollectionId)


  // Build the selected item with full details - use getState() to access functions
  const selectedItem = useMemo((): BrowserItem | null => {
    if (!selectedItemState || !collectionsMap.has(selectedItemState.collectionId)) return null

    const { item, collectionId } = selectedItemState
    const { getTableList, getTemplateList } = useCollectionStore.getState()

    return browserItemFromRoute(getTableList(collectionId), getTemplateList(collectionId), item.id, item.type)
  }, [selectedItemState, collectionsMap])

  // Can roll if we have a selected item
  const canRoll = isInitialized && selectedItem !== null

  // Handle rolling
  const handleRoll = useCallback(async () => {
    if (!canRoll || isRolling || !selectedItemState) return

    const { item, collectionId } = selectedItemState

    try {
      if (item.type === 'template') await rollOnTemplate(collectionId, item.id)
      else await rollOnTable(collectionId, item.id)
    } catch { /* Store exposes the roll error. */ }
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

      try {
        if (item.type === 'template') await rollOnTemplate(collectionId, item.id)
        else await rollOnTable(collectionId, item.id)
      } catch { /* Store exposes the roll error. */ }
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
      try {
        if (item.type === 'template') rollResult = await rollOnTemplate(collectionId, item.id)
        else rollResult = await rollOnTable(collectionId, item.id)
      } catch { return } // Store exposes the roll error.

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

  useKeyboardShortcuts({ shortcuts, enabled: !rollMultipleModal && !viewDetailsModal })

  // Highlight only rows with the selected collection, kind, and item ID.
  const selectedItemKey = selectedItemState ? browserItemKey(selectedItemState.collectionId, selectedItemState.item) : null

  return (
    <>
      <SEO {...PAGE_SEO.roll} />
      <div className="h-[calc(100vh-4rem)]">
        <SplitPanelLayout
        leftPanel={({ onMobileClose }) => (
          <BrowserPanel
            selectedItemKey={selectedItemKey}
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
            currentRoll={currentRoll}
            currentItemName={currentItemName}
            onReroll={async (source) => {
              try {
                if (source.templateId) await rollOnTemplate(source.collectionId, source.templateId)
                else if (source.tableId) await rollOnTable(source.collectionId, source.tableId)
              } catch { /* Store exposes the roll error. */ }
            }}
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
