/**
 * PublisherAccordion Component
 *
 * Groups collections by publisher namespace and displays them in a nested accordion.
 * Publishers are the top-level expandable groups, with collections nested inside.
 * Only one publisher can be expanded at a time.
 */

import { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { ChevronRight, FolderTree, Filter, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { parseNamespace, formatNamespaceSegment } from '@/lib/namespaceUtils'
import { CollectionAccordionItem } from './CollectionAccordionItem'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import type { CollectionMeta } from '@/stores/collectionStore'

// Special publisher ID for user-imported collections
const MY_COLLECTIONS_ID = '__my_collections__'

interface PublisherAccordionProps {
  /** Pre-filtered collections to display */
  collections: CollectionMeta[]
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

interface PublisherGroup {
  id: string
  name: string
  collections: CollectionMeta[]
  isUserGroup: boolean
}

export const PublisherAccordion = memo(function PublisherAccordion({
  collections,
  selectedItemId,
  onSelectItem,
  onRollItem,
  onEditItem,
  onCopyResult,
  onRollMultiple,
  onViewDetails,
}: PublisherAccordionProps) {
  const expandedPublisherId = useUIStore((state) => state.expandedPublisherId)
  const togglePublisherExpanded = useUIStore((state) => state.togglePublisherExpanded)
  const setExpandedPublisherId = useUIStore((state) => state.setExpandedPublisherId)
  const expandedCollectionId = useUIStore((state) => state.expandedCollectionId)
  const setExpandedCollectionId = useUIStore((state) => state.setExpandedCollectionId)
  const setBrowserActiveTab = useUIStore((state) => state.setBrowserActiveTab)

  // Track which collection should scroll into view
  const [scrollTargetCollectionId, setScrollTargetCollectionId] = useState<string | null>(null)

  // Track if we've already auto-expanded
  const hasAutoExpanded = useRef(false)

  // Group collections by publisher
  const publisherGroups = useMemo((): PublisherGroup[] => {
    const groups = new Map<string, CollectionMeta[]>()
    const userCollections: CollectionMeta[] = []

    for (const collection of collections) {
      // User-imported collections (not preloaded) or those without namespace go to "My Collections"
      if (!collection.isPreloaded || !collection.namespace) {
        userCollections.push(collection)
      } else {
        // Get publisher from namespace (depth 1)
        const publisher = parseNamespace(collection.namespace, 1)
        if (publisher === 'Uncategorized') {
          userCollections.push(collection)
        } else {
          if (!groups.has(publisher)) {
            groups.set(publisher, [])
          }
          groups.get(publisher)!.push(collection)
        }
      }
    }

    // Sort collections within each group alphabetically
    for (const [, groupCollections] of groups) {
      groupCollections.sort((a, b) => a.name.localeCompare(b.name))
    }
    userCollections.sort((a, b) => a.name.localeCompare(b.name))

    // Build result array: My Collections first, then publishers alphabetically
    const result: PublisherGroup[] = []

    if (userCollections.length > 0) {
      result.push({
        id: MY_COLLECTIONS_ID,
        name: 'My Collections',
        collections: userCollections,
        isUserGroup: true,
      })
    }

    const sortedPublishers = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b))
    for (const publisher of sortedPublishers) {
      result.push({
        id: publisher,
        name: formatNamespaceSegment(publisher),
        collections: groups.get(publisher)!,
        isUserGroup: false,
      })
    }

    return result
  }, [collections])

  // Auto-expand first publisher if nothing is expanded
  useEffect(() => {
    if (hasAutoExpanded.current || expandedPublisherId !== null) {
      return
    }

    if (publisherGroups.length > 0) {
      hasAutoExpanded.current = true
      setExpandedPublisherId(publisherGroups[0].id)
    }
  }, [publisherGroups, expandedPublisherId, setExpandedPublisherId])

  // Auto-expand publisher when a collection is expanded programmatically
  useEffect(() => {
    if (!expandedCollectionId) return

    // Find which publisher contains this collection
    for (const group of publisherGroups) {
      const hasCollection = group.collections.some((c) => c.id === expandedCollectionId)
      if (hasCollection && expandedPublisherId !== group.id) {
        setExpandedPublisherId(group.id)
        break
      }
    }
  }, [expandedCollectionId, publisherGroups, expandedPublisherId, setExpandedPublisherId])

  const handleTogglePublisher = useCallback(
    (publisherId: string) => {
      togglePublisherExpanded(publisherId)
    },
    [togglePublisherExpanded]
  )

  const handleScrollComplete = useCallback(() => {
    setScrollTargetCollectionId(null)
  }, [])

  const handleSelectItem = useCallback(
    (item: BrowserItem, collectionId: string) => {
      // Expand the collection if not already expanded
      if (expandedCollectionId !== collectionId) {
        setExpandedCollectionId(collectionId)
        setScrollTargetCollectionId(collectionId)
      }
      setBrowserActiveTab(item.type === 'template' ? 'templates' : 'tables')
      onSelectItem(item, collectionId)
    },
    [onSelectItem, expandedCollectionId, setExpandedCollectionId, setBrowserActiveTab]
  )

  const handleRollItem = useCallback(
    (item: BrowserItem, collectionId: string) => {
      if (expandedCollectionId !== collectionId) {
        setExpandedCollectionId(collectionId)
        setScrollTargetCollectionId(collectionId)
      }
      setBrowserActiveTab(item.type === 'template' ? 'templates' : 'tables')
      onRollItem(item, collectionId)
    },
    [onRollItem, expandedCollectionId, setExpandedCollectionId, setBrowserActiveTab]
  )

  if (publisherGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Filter className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No collections match filters</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Try adjusting your search or namespace filter
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto" role="list" aria-label="Publishers">
      {publisherGroups.map((group) => (
        <PublisherGroup
          key={group.id}
          group={group}
          isExpanded={expandedPublisherId === group.id}
          expandedCollectionId={expandedCollectionId}
          selectedItemId={selectedItemId}
          scrollTargetCollectionId={scrollTargetCollectionId}
          onTogglePublisher={() => handleTogglePublisher(group.id)}
          onScrollComplete={handleScrollComplete}
          onSelectItem={handleSelectItem}
          onRollItem={handleRollItem}
          onEditItem={onEditItem}
          onCopyResult={onCopyResult}
          onRollMultiple={onRollMultiple}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  )
})

interface PublisherGroupProps {
  group: PublisherGroup
  isExpanded: boolean
  expandedCollectionId: string | null
  selectedItemId: string | null
  scrollTargetCollectionId: string | null
  onTogglePublisher: () => void
  onScrollComplete: () => void
  onSelectItem: (item: BrowserItem, collectionId: string) => void
  onRollItem: (item: BrowserItem, collectionId: string) => void
  onEditItem?: (item: BrowserItem, collectionId: string) => void
  onCopyResult?: (item: BrowserItem, collectionId: string) => void
  onRollMultiple?: (item: BrowserItem, collectionId: string) => void
  onViewDetails?: (item: BrowserItem, collectionId: string) => void
}

const PublisherGroup = memo(function PublisherGroup({
  group,
  isExpanded,
  expandedCollectionId,
  selectedItemId,
  scrollTargetCollectionId,
  onTogglePublisher,
  onScrollComplete,
  onSelectItem,
  onRollItem,
  onEditItem,
  onCopyResult,
  onRollMultiple,
  onViewDetails,
}: PublisherGroupProps) {
  const toggleCollectionExpanded = useUIStore((state) => state.toggleCollectionExpanded)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onTogglePublisher()
    }
  }

  const handleToggleCollection = useCallback(
    (collectionId: string) => {
      toggleCollectionExpanded(collectionId)
    },
    [toggleCollectionExpanded]
  )

  const Icon = group.isUserGroup ? User : FolderTree

  return (
    <div className="border-b border-white/5">
      {/* Publisher Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors duration-150',
          isExpanded ? 'bg-copper/10' : 'hover:bg-white/5'
        )}
        onClick={onTogglePublisher}
        onKeyDown={handleKeyDown}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
      >
        {/* Chevron */}
        <ChevronRight
          className={cn(
            'w-4 h-4 flex-shrink-0 transition-transform duration-200',
            isExpanded ? 'rotate-90 text-copper' : 'text-muted-foreground'
          )}
        />

        {/* Publisher Icon */}
        <div
          className={cn(
            'p-1.5 rounded-md transition-colors',
            isExpanded ? 'bg-copper/20 text-copper' : 'bg-white/5 text-muted-foreground'
          )}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>

        {/* Publisher Name */}
        <span
          className={cn(
            'flex-1 truncate text-sm font-medium transition-colors',
            isExpanded ? 'text-copper' : 'text-foreground'
          )}
        >
          {group.name}
        </span>

        {/* Collection Count Badge */}
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium transition-colors',
            isExpanded ? 'bg-copper/20 text-copper' : 'bg-white/10 text-muted-foreground'
          )}
        >
          {group.collections.length}
        </span>
      </div>

      {/* Publisher Content - Collections */}
      {isExpanded && (
        <div className="pl-4 border-l-2 border-copper/20 ml-4">
          {group.collections.map((collection) => (
            <CollectionAccordionItem
              key={collection.id}
              collection={collection}
              isExpanded={expandedCollectionId === collection.id}
              selectedItemId={selectedItemId}
              shouldScrollIntoView={scrollTargetCollectionId === collection.id}
              onScrollComplete={onScrollComplete}
              onToggleExpand={() => handleToggleCollection(collection.id)}
              onSelectItem={(item) => onSelectItem(item, collection.id)}
              onRollItem={(item) => onRollItem(item, collection.id)}
              onEditItem={onEditItem ? (item) => onEditItem(item, collection.id) : undefined}
              onCopyResult={onCopyResult ? (item) => onCopyResult(item, collection.id) : undefined}
              onRollMultiple={
                onRollMultiple ? (item) => onRollMultiple(item, collection.id) : undefined
              }
              onViewDetails={
                onViewDetails ? (item) => onViewDetails(item, collection.id) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
})

export default PublisherAccordion
