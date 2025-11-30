/**
 * CollectionAccordion Component
 *
 * Displays collections as an accordion list.
 * Only one collection can be expanded at a time.
 */

import { memo, useCallback, useMemo } from 'react'
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
}

export const CollectionAccordion = memo(function CollectionAccordion({
  selectedItemId,
  onSelectItem,
  onRollItem,
}: CollectionAccordionProps) {
  // Select the Map directly to avoid creating new arrays in the selector
  const collectionsMap = useCollectionStore((state) => state.collections)
  const expandedCollectionId = useUIStore((state) => state.expandedCollectionId)
  const toggleCollectionExpanded = useUIStore((state) => state.toggleCollectionExpanded)

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

  const handleToggleExpand = useCallback(
    (id: string) => {
      toggleCollectionExpanded(id)
    },
    [toggleCollectionExpanded]
  )

  const handleSelectItem = useCallback(
    (item: BrowserItem, collectionId: string) => {
      onSelectItem(item, collectionId)
    },
    [onSelectItem]
  )

  const handleRollItem = useCallback(
    (item: BrowserItem, collectionId: string) => {
      onRollItem(item, collectionId)
    },
    [onRollItem]
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
          onToggleExpand={() => handleToggleExpand(collection.id)}
          onSelectItem={(item) => handleSelectItem(item, collection.id)}
          onRollItem={(item) => handleRollItem(item, collection.id)}
        />
      ))}
    </div>
  )
})

export default CollectionAccordion
