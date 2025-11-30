/**
 * BrowserPanel Component
 *
 * Left panel containing the collection accordion.
 * Each collection expands to show its tables/templates.
 */

import { memo, useCallback } from 'react'
import { CollectionAccordion } from './CollectionAccordion'
import type { BrowserItem } from '@/hooks/useBrowserFilter'

interface BrowserPanelProps {
  /** Currently selected item ID (table or template) */
  selectedItemId: string | null
  /** Callback when an item is selected */
  onSelectItem: (item: BrowserItem, collectionId: string) => void
  /** Callback when an item is rolled */
  onRollItem: (item: BrowserItem, collectionId: string) => void
  /** Callback to close the mobile drawer (only provided on mobile) */
  onMobileClose?: () => void
}

export const BrowserPanel = memo(function BrowserPanel({
  selectedItemId,
  onSelectItem,
  onRollItem,
  onMobileClose,
}: BrowserPanelProps) {
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

  return (
    <div className="flex flex-col h-full">
      <CollectionAccordion
        selectedItemId={selectedItemId}
        onSelectItem={handleSelectItem}
        onRollItem={handleRollItem}
      />
    </div>
  )
})

export default BrowserPanel
