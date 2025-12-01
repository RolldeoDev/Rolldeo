/**
 * CollectionAccordion Component
 *
 * Displays collections as an accordion list.
 * Only one collection can be expanded at a time.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCollectionStore } from '@/stores/collectionStore'
import { useUIStore } from '@/stores/uiStore'
import { CollectionAccordionItem } from './CollectionAccordionItem'
import { FolderPlus } from 'lucide-react'
import type { BrowserItem } from '@/hooks/useBrowserFilter'

interface CollectionAccordionProps {
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
}

export const CollectionAccordion = memo(function CollectionAccordion({
  selectedItemId,
  onSelectItem,
  onRollItem,
  onEditItem,
  onCopyResult,
  onRollMultiple,
  onViewDetails,
}: CollectionAccordionProps) {
  // Select the Map directly to avoid creating new arrays in the selector
  const collectionsMap = useCollectionStore((state) => state.collections)
  const expandedCollectionId = useUIStore((state) => state.expandedCollectionId)
  const toggleCollectionExpanded = useUIStore((state) => state.toggleCollectionExpanded)
  const setExpandedCollectionId = useUIStore((state) => state.setExpandedCollectionId)
  const setBrowserActiveTab = useUIStore((state) => state.setBrowserActiveTab)

  // Track which collection should scroll into view
  const [scrollTargetCollectionId, setScrollTargetCollectionId] = useState<string | null>(null)

  // Convert Map to sorted array with useMemo
  const sortedCollections = useMemo(() => {
    const collections = Array.from(collectionsMap.values())
    return collections.sort((a, b) => {
      if (a.isPreloaded !== b.isPreloaded) {
        return a.isPreloaded ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }, [collectionsMap])

  // Track if we've already auto-expanded to prevent re-triggering
  const hasAutoExpanded = useRef(false)

  // Auto-expand first preloaded collection if user has no imported collections
  useEffect(() => {
    // Skip if we've already auto-expanded or if something is already expanded
    if (hasAutoExpanded.current || expandedCollectionId !== null) {
      return
    }

    const userCollections = sortedCollections.filter((c) => !c.isPreloaded)
    const preloadedCollections = sortedCollections.filter((c) => c.isPreloaded)

    // If user has no imported collections and there are preloaded collections available
    if (userCollections.length === 0 && preloadedCollections.length > 0) {
      hasAutoExpanded.current = true
      setExpandedCollectionId(preloadedCollections[0].id)
    }
  }, [sortedCollections, expandedCollectionId, setExpandedCollectionId])

  const handleToggleExpand = useCallback(
    (id: string) => {
      toggleCollectionExpanded(id)
    },
    [toggleCollectionExpanded]
  )

  const handleScrollComplete = useCallback(() => {
    setScrollTargetCollectionId(null)
  }, [])

  const handleSelectItem = useCallback(
    (item: BrowserItem, collectionId: string) => {
      // Expand the collection if not already expanded
      if (expandedCollectionId !== collectionId) {
        setExpandedCollectionId(collectionId)
        // Only scroll when switching to a different collection
        setScrollTargetCollectionId(collectionId)
      }
      // Switch to the correct tab based on item type
      setBrowserActiveTab(item.type === 'template' ? 'templates' : 'tables')
      // Call the parent handler
      onSelectItem(item, collectionId)
    },
    [onSelectItem, expandedCollectionId, setExpandedCollectionId, setBrowserActiveTab]
  )

  const handleRollItem = useCallback(
    (item: BrowserItem, collectionId: string) => {
      // Expand the collection if not already expanded
      if (expandedCollectionId !== collectionId) {
        setExpandedCollectionId(collectionId)
        // Only scroll when switching to a different collection
        setScrollTargetCollectionId(collectionId)
      }
      // Switch to the correct tab based on item type
      setBrowserActiveTab(item.type === 'template' ? 'templates' : 'tables')
      // Call the parent handler
      onRollItem(item, collectionId)
    },
    [onRollItem, expandedCollectionId, setExpandedCollectionId, setBrowserActiveTab]
  )

  if (sortedCollections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <FolderPlus className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">No collections loaded</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Import a JSON file to get started
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto" role="list" aria-label="Collections">
      {sortedCollections.map((collection) => (
        <CollectionAccordionItem
          key={collection.id}
          collection={collection}
          isExpanded={expandedCollectionId === collection.id}
          selectedItemId={selectedItemId}
          shouldScrollIntoView={scrollTargetCollectionId === collection.id}
          onScrollComplete={handleScrollComplete}
          onToggleExpand={() => handleToggleExpand(collection.id)}
          onSelectItem={(item) => handleSelectItem(item, collection.id)}
          onRollItem={(item) => handleRollItem(item, collection.id)}
          onEditItem={onEditItem ? (item) => onEditItem(item, collection.id) : undefined}
          onCopyResult={onCopyResult ? (item) => onCopyResult(item, collection.id) : undefined}
          onRollMultiple={onRollMultiple ? (item) => onRollMultiple(item, collection.id) : undefined}
          onViewDetails={onViewDetails ? (item) => onViewDetails(item, collection.id) : undefined}
        />
      ))}
    </div>
  )
})

export default CollectionAccordion
