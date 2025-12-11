/**
 * CollectionAccordionItem Component
 *
 * A single accordion item representing a collection.
 * When expanded, shows tabs, search, filter controls, and virtualized item list.
 */

import { memo, useMemo, useCallback, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import type { CollectionMeta } from '@/stores/collectionStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useUIStore } from '@/stores/uiStore'
import { useBrowserFilter, type BrowserItem } from '@/hooks/useBrowserFilter'
import { BrowserTabs } from './BrowserTabs'
import { BrowserViewToggle } from './BrowserViewToggle'
import { VirtualizedItemList } from './VirtualizedItemList'

interface CollectionAccordionItemProps {
  collection: CollectionMeta
  isExpanded: boolean
  selectedItemId: string | null
  /** When true, scroll this accordion header into view */
  shouldScrollIntoView: boolean
  /** Called after scrolling completes */
  onScrollComplete: () => void
  onToggleExpand: () => void
  onSelectItem: (item: BrowserItem) => void
  onRollItem: (item: BrowserItem) => void
  onEditItem?: (item: BrowserItem) => void
  onCopyResult?: (item: BrowserItem) => void
  onRollMultiple?: (item: BrowserItem) => void
  onViewDetails?: (item: BrowserItem) => void
}

export const CollectionAccordionItem = memo(function CollectionAccordionItem({
  collection,
  isExpanded,
  selectedItemId,
  shouldScrollIntoView,
  onScrollComplete,
  onToggleExpand,
  onSelectItem,
  onRollItem,
  onEditItem,
  onCopyResult,
  onRollMultiple,
  onViewDetails,
}: CollectionAccordionItemProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight
  const FolderIcon = isExpanded ? FolderOpen : Folder

  // Scroll into view when requested
  useEffect(() => {
    if (shouldScrollIntoView && headerRef.current) {
      // Small delay to let expansion animation start
      requestAnimationFrame(() => {
        headerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
        onScrollComplete()
      })
    }
  }, [shouldScrollIntoView, onScrollComplete])

  // Subscribe to collections Map to trigger re-renders when data changes
  const collectionsMap = useCollectionStore((state) => state.collections)

  const browserActiveTab = useUIStore((state) => state.browserActiveTab)
  const browserViewMode = useUIStore((state) => state.browserViewMode)
  const browserGroupBy = useUIStore((state) => state.browserGroupBy)
  const showHiddenTables = useUIStore((state) => state.showHiddenTables)
  // Use the global search query from the filter bar at the top
  const globalSearchQuery = useUIStore((state) => state.rollerCollectionSearchQuery)

  const setBrowserActiveTab = useUIStore((state) => state.setBrowserActiveTab)
  const setBrowserViewMode = useUIStore((state) => state.setBrowserViewMode)
  const setBrowserGroupBy = useUIStore((state) => state.setBrowserGroupBy)

  // Get tables and templates for this collection - use getState() to access functions
  const tables = useMemo(() => {
    return useCollectionStore.getState().getTableList(collection.id)
  }, [collection.id, collectionsMap])

  const templates = useMemo(() => {
    return useCollectionStore.getState().getTemplateList(collection.id)
  }, [collection.id, collectionsMap])

  // Filter and group items using the global search query
  const { filteredItems, groupedItems, filteredCount, totalCount } = useBrowserFilter({
    tables,
    templates,
    searchQuery: globalSearchQuery,
    viewMode: browserViewMode,
    groupBy: browserGroupBy,
    activeTab: browserActiveTab,
    showHidden: showHiddenTables,
  })

  // Calculate filtered counts for both tabs when search is active
  const isFiltering = globalSearchQuery.trim().length > 0
  const filteredTableCount = useMemo(() => {
    if (!isFiltering) return tables.length
    const query = globalSearchQuery.toLowerCase()
    return tables.filter(t => {
      if (t.hidden && !showHiddenTables) return false
      return t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
    }).length
  }, [tables, globalSearchQuery, isFiltering, showHiddenTables])

  const filteredTemplateCount = useMemo(() => {
    if (!isFiltering) return templates.length
    const query = globalSearchQuery.toLowerCase()
    return templates.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query) ||
      t.tags?.some(tag => tag.toLowerCase().includes(query))
    ).length
  }, [templates, globalSearchQuery, isFiltering])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggleExpand()
    }
  }

  const handleSelectItem = useCallback(
    (item: BrowserItem) => {
      onSelectItem(item)
    },
    [onSelectItem]
  )

  const handleRollItem = useCallback(
    (item: BrowserItem) => {
      onRollItem(item)
    },
    [onRollItem]
  )

  return (
    <div className="border-b border-white/5 relative isolate">
      {/* Accordion Header */}
      <div
        ref={headerRef}
        className={`
          flex items-center gap-2 px-3 py-3 cursor-pointer
          transition-colors duration-150 relative z-10 bg-background
          ${isExpanded ? 'bg-copper/10 border-l-2 border-l-copper/50' : 'border-l-2 border-l-transparent hover:bg-white/5'}
        `}
        onClick={onToggleExpand}
        onKeyDown={handleKeyDown}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
      >
        {/* Expand/Collapse Icon */}
        <ChevronIcon
          className={`w-4 h-4 transition-all duration-200 ${
            isExpanded ? 'text-copper' : 'text-muted-foreground'
          }`}
        />

        {/* Folder Icon */}
        <FolderIcon className="w-4 h-4 text-amber-400/80 flex-shrink-0" />

        {/* Collection Name */}
        <span className="flex-1 truncate text-sm font-medium">
          {collection.name}
        </span>

        {/* Counts - differentiated badges (show filtered counts when searching) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-mint/15 text-mint border border-mint/20">
            {isFiltering ? filteredTableCount : collection.tableCount}{isFiltering && '*'}
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-lavender/15 text-lavender border border-lavender/20">
            {isFiltering ? filteredTemplateCount : collection.templateCount}{isFiltering && '*'}
          </span>
        </div>
      </div>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="flex flex-col bg-background/50 relative z-0">
          {/* Tabs */}
          <BrowserTabs
            activeTab={browserActiveTab}
            onTabChange={setBrowserActiveTab}
            tableCount={tables.length}
            templateCount={templates.length}
            filteredTableCount={filteredTableCount}
            filteredTemplateCount={filteredTemplateCount}
            isFiltering={isFiltering}
          />

          {/* View Toggle */}
          <BrowserViewToggle
            viewMode={browserViewMode}
            groupBy={browserGroupBy}
            onViewModeChange={setBrowserViewMode}
            onGroupByChange={setBrowserGroupBy}
          />

          {/* Filter Status - show when global search is active */}
          {globalSearchQuery && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-white/5">
              Showing {filteredCount} of {totalCount} {browserActiveTab}
            </div>
          )}

          {/* Virtualized Item List */}
          <div className="min-h-[150px] max-h-[50vh] flex flex-col isolate">
            <VirtualizedItemList
              items={filteredItems}
              groupedItems={groupedItems}
              isGrouped={browserViewMode === 'grouped'}
              collectionId={collection.id}
              selectedItemId={selectedItemId}
              onSelectItem={handleSelectItem}
              onRollItem={handleRollItem}
              onEditItem={onEditItem}
              onCopyResult={onCopyResult}
              onRollMultiple={onRollMultiple}
              onViewDetails={onViewDetails}
            />
          </div>
        </div>
      )}
    </div>
  )
})

export default CollectionAccordionItem
