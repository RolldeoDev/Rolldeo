/**
 * BrowserPanel Component
 *
 * Left panel containing the collection filter bar and accordion.
 * Each collection expands to show its tables/templates.
 */

import { memo, useCallback, useMemo } from 'react'
import { CollectionAccordion } from './CollectionAccordion'
import { CollectionFilterBar } from './CollectionFilterBar'
import { useCollections } from '@/hooks/useCollections'
import { useCollectionStore } from '@/stores/collectionStore'
import type { BrowserItem } from '@/hooks/useBrowserFilter'

interface BrowserPanelProps {
  /** Currently selected item ID (table or template) */
  selectedItemId: string | null
  /** Callback when an item is selected */
  onSelectItem: (item: BrowserItem, collectionId: string) => void
  /** Callback when an item is rolled */
  onRollItem: (item: BrowserItem, collectionId: string) => void
  /** Callback when edit is requested */
  onEditItem?: (item: BrowserItem, collectionId: string) => void
  /** Callback to copy roll result */
  onCopyResult?: (item: BrowserItem, collectionId: string) => void
  /** Callback to roll multiple times */
  onRollMultiple?: (item: BrowserItem, collectionId: string) => void
  /** Callback to view item details */
  onViewDetails?: (item: BrowserItem, collectionId: string) => void
  /** Callback to close the mobile drawer (only provided on mobile) */
  onMobileClose?: () => void
}

export const BrowserPanel = memo(function BrowserPanel({
  selectedItemId,
  onSelectItem,
  onRollItem,
  onEditItem,
  onCopyResult,
  onRollMultiple,
  onViewDetails,
  onMobileClose,
}: BrowserPanelProps) {
  // Get collections with roller filters
  const { collections, allNamespaces } = useCollections({ useRollerFilters: true })
  const storeCollections = useCollectionStore((state) => state.collections)

  // Get total count before filtering
  const totalCount = useMemo(() => {
    return Array.from(storeCollections.values()).length
  }, [storeCollections])

  const handleSelectItem = useCallback(
    (item: BrowserItem, collectionId: string) => {
      onSelectItem(item, collectionId)
      // Close mobile drawer after selection
      onMobileClose?.()
    },
    [onSelectItem, onMobileClose]
  )

  const handleRollItem = useCallback(
    (item: BrowserItem, collectionId: string) => {
      onRollItem(item, collectionId)
      // Close mobile drawer after roll
      onMobileClose?.()
    },
    [onRollItem, onMobileClose]
  )

  const handleEditItem = useCallback(
    (item: BrowserItem, collectionId: string) => {
      onEditItem?.(item, collectionId)
      onMobileClose?.()
    },
    [onEditItem, onMobileClose]
  )

  const handleCopyResult = useCallback(
    (item: BrowserItem, collectionId: string) => {
      onCopyResult?.(item, collectionId)
      onMobileClose?.()
    },
    [onCopyResult, onMobileClose]
  )

  const handleRollMultiple = useCallback(
    (item: BrowserItem, collectionId: string) => {
      onRollMultiple?.(item, collectionId)
      onMobileClose?.()
    },
    [onRollMultiple, onMobileClose]
  )

  const handleViewDetails = useCallback(
    (item: BrowserItem, collectionId: string) => {
      onViewDetails?.(item, collectionId)
      onMobileClose?.()
    },
    [onViewDetails, onMobileClose]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Collection filter bar */}
      <CollectionFilterBar
        allNamespaces={allNamespaces}
        totalCount={totalCount}
        filteredCount={collections.length}
      />

      {/* Collection accordion */}
      <div className="flex-1 overflow-hidden">
        <CollectionAccordion
          collections={collections}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          onRollItem={handleRollItem}
          onEditItem={onEditItem ? handleEditItem : undefined}
          onCopyResult={onCopyResult ? handleCopyResult : undefined}
          onRollMultiple={onRollMultiple ? handleRollMultiple : undefined}
          onViewDetails={onViewDetails ? handleViewDetails : undefined}
        />
      </div>
    </div>
  )
})

export default BrowserPanel
