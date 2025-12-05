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
import { BrowserSearchBar } from './BrowserSearchBar'
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

  // Store selectors
  const getTableList = useCollectionStore((state) => state.getTableList)
  const getTemplateList = useCollectionStore((state) => state.getTemplateList)

  const browserActiveTab = useUIStore((state) => state.browserActiveTab)
  const browserViewMode = useUIStore((state) => state.browserViewMode)
  const browserGroupBy = useUIStore((state) => state.browserGroupBy)
  const browserSearchQuery = useUIStore((state) => state.browserSearchQuery)
  const showHiddenTables = useUIStore((state) => state.showHiddenTables)

  const setBrowserActiveTab = useUIStore((state) => state.setBrowserActiveTab)
  const setBrowserViewMode = useUIStore((state) => state.setBrowserViewMode)
  const setBrowserGroupBy = useUIStore((state) => state.setBrowserGroupBy)
  const setBrowserSearchQuery = useUIStore((state) => state.setBrowserSearchQuery)

  // Get tables and templates for this collection
  const tables = useMemo(() => {
    return getTableList(collection.id)
  }, [collection.id, getTableList])

  const templates = useMemo(() => {
    return getTemplateList(collection.id)
  }, [collection.id, getTemplateList])

  // Filter and group items
  const { filteredItems, groupedItems, filteredCount, totalCount } = useBrowserFilter({
    tables,
    templates,
    searchQuery: browserSearchQuery,
    viewMode: browserViewMode,
    groupBy: browserGroupBy,
    activeTab: browserActiveTab,
    showHidden: showHiddenTables,
  })

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
          ${isExpanded ? 'bg-primary/10' : 'hover:bg-white/5'}
        `}
        onClick={onToggleExpand}
        onKeyDown={handleKeyDown}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
      >
        {/* Expand/Collapse Icon */}
        <ChevronIcon
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            isExpanded ? 'rotate-0' : ''
          }`}
        />

        {/* Folder Icon */}
        <FolderIcon className="w-4 h-4 text-amber-400/80 flex-shrink-0" />

        {/* Collection Name */}
        <span className="flex-1 truncate text-sm font-medium">
          {collection.name}
        </span>

        {/* Counts */}
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {collection.tableCount}T / {collection.templateCount}P
        </span>
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
          />

          {/* Search Bar */}
          <BrowserSearchBar
            value={browserSearchQuery}
            onChange={setBrowserSearchQuery}
            placeholder={`Search ${browserActiveTab}...`}
          />

          {/* View Toggle */}
          <BrowserViewToggle
            viewMode={browserViewMode}
            groupBy={browserGroupBy}
            onViewModeChange={setBrowserViewMode}
            onGroupByChange={setBrowserGroupBy}
          />

          {/* Filter Status */}
          {browserSearchQuery && (
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
