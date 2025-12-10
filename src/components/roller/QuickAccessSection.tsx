/**
 * QuickAccessSection Component
 *
 * Tabbed section showing Recent and Popular tables/templates.
 * Appears below Favorites in the BrowserPanel.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight, Clock, TrendingUp, Dices } from 'lucide-react'
import { useUsageStore } from '@/stores/usageStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useUIStore } from '@/stores/uiStore'
import { getResultTypeIcon } from '@/lib/resultTypeIcons'
import { formatTimestamp } from '@/stores/rollStore'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import type { UsageStats } from '@/services/db'

interface QuickAccessSectionProps {
  selectedItemId: string | null
  onSelectItem: (item: BrowserItem, collectionId: string) => void
  onRollItem: (item: BrowserItem, collectionId: string) => void
  searchQuery?: string
}

type QuickAccessTab = 'recent' | 'popular'

interface EnrichedUsage {
  stats: UsageStats
  item: BrowserItem
  collectionId: string
  collectionName: string
}

export const QuickAccessSection = memo(function QuickAccessSection({
  selectedItemId,
  onSelectItem,
  onRollItem,
  searchQuery = '',
}: QuickAccessSectionProps) {
  // Use store state for expanded instead of local state
  const isExpanded = useUIStore((state) => state.isQuickAccessSectionExpanded)
  const setQuickAccessSectionExpanded = useUIStore((state) => state.setQuickAccessSectionExpanded)
  const [activeTab, setActiveTab] = useState<QuickAccessTab>('recent')

  const recentItems = useUsageStore((state) => state.recentItems)
  const popularItems = useUsageStore((state) => state.popularItems)
  // Subscribe to collections Map to trigger re-renders when data changes
  const collectionsMap = useCollectionStore((state) => state.collections)

  // Enrich usage stats with item metadata - use getState() to access functions
  const enrichedRecent = useMemo((): EnrichedUsage[] => {
    const { getCollection, getTableList, getTemplateList } = useCollectionStore.getState()
    const result: EnrichedUsage[] = []

    for (const stats of recentItems) {
      const collection = getCollection(stats.collectionId)
      if (!collection) continue

      let item: BrowserItem | undefined

      if (stats.type === 'table') {
        const tables = getTableList(stats.collectionId)
        const table = tables.find((t) => t.id === stats.itemId)
        if (table) {
          item = {
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
        }
      } else {
        const templates = getTemplateList(stats.collectionId)
        const template = templates.find((t) => t.id === stats.itemId)
        if (template) {
          item = {
            id: template.id,
            name: template.name,
            type: 'template',
            description: template.description,
            tags: template.tags,
            resultType: template.resultType,
          }
        }
      }

      if (item) {
        result.push({
          stats,
          item,
          collectionId: stats.collectionId,
          collectionName: collection.name,
        })
      }
    }

    return result
  }, [recentItems, collectionsMap])

  const enrichedPopular = useMemo((): EnrichedUsage[] => {
    const { getCollection, getTableList, getTemplateList } = useCollectionStore.getState()
    const result: EnrichedUsage[] = []

    for (const stats of popularItems) {
      const collection = getCollection(stats.collectionId)
      if (!collection) continue

      let item: BrowserItem | undefined

      if (stats.type === 'table') {
        const tables = getTableList(stats.collectionId)
        const table = tables.find((t) => t.id === stats.itemId)
        if (table) {
          item = {
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
        }
      } else {
        const templates = getTemplateList(stats.collectionId)
        const template = templates.find((t) => t.id === stats.itemId)
        if (template) {
          item = {
            id: template.id,
            name: template.name,
            type: 'template',
            description: template.description,
            tags: template.tags,
            resultType: template.resultType,
          }
        }
      }

      if (item) {
        result.push({
          stats,
          item,
          collectionId: stats.collectionId,
          collectionName: collection.name,
        })
      }
    }

    return result
  }, [popularItems, collectionsMap])

  // Filter by search query
  const filterByQuery = useCallback((items: EnrichedUsage[]) => {
    if (!searchQuery.trim()) return items

    const query = searchQuery.toLowerCase()
    return items.filter((usage) => {
      // Match against item name, description, or collection name
      const nameMatch = usage.item.name.toLowerCase().includes(query)
      const descMatch = usage.item.description?.toLowerCase().includes(query)
      const collectionMatch = usage.collectionName.toLowerCase().includes(query)
      return nameMatch || descMatch || collectionMatch
    })
  }, [searchQuery])

  const filteredRecent = useMemo(() => filterByQuery(enrichedRecent), [filterByQuery, enrichedRecent])
  const filteredPopular = useMemo(() => filterByQuery(enrichedPopular), [filterByQuery, enrichedPopular])
  const currentItems = activeTab === 'recent' ? filteredRecent : filteredPopular

  const handleToggle = useCallback(() => {
    setQuickAccessSectionExpanded(!isExpanded)
  }, [setQuickAccessSectionExpanded, isExpanded])

  // Don't render if no usage data at all
  if (enrichedRecent.length === 0 && enrichedPopular.length === 0) {
    return null
  }

  // Check if we're filtering
  const isFiltering = searchQuery.trim().length > 0
  const totalCurrent = activeTab === 'recent' ? enrichedRecent.length : enrichedPopular.length

  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight

  return (
    <div className="border-b border-white/5">
      {/* Header */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2.5 cursor-pointer
          transition-colors duration-150
          ${isExpanded ? 'bg-cyan/3' : 'hover:bg-white/5'}
        `}
        onClick={handleToggle}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggle()
          }
        }}
      >
        <ChevronIcon className={`w-4 h-4 ${isExpanded ? 'text-cyan' : 'text-muted-foreground'}`} />
        {activeTab === 'recent' ? (
          <Clock className="w-4 h-4 text-cyan" />
        ) : (
          <TrendingUp className="w-4 h-4 text-cyan" />
        )}
        <span className="flex-1 text-sm font-medium">Quick Access</span>
        <span className="text-xs text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
          {isFiltering ? `${currentItems.length}/${totalCurrent}` : currentItems.length}
        </span>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="bg-background/50">
          {/* Tabs */}
          <div className="flex border-b border-white/5">
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors
                ${activeTab === 'recent'
                  ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
                  : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('recent')}
            >
              <Clock className="w-3 h-3" />
              Recent
              {isFiltering && (
                <span className="text-[10px] opacity-70">({filteredRecent.length})</span>
              )}
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors
                ${activeTab === 'popular'
                  ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
                  : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveTab('popular')}
            >
              <TrendingUp className="w-3 h-3" />
              Popular
              {isFiltering && (
                <span className="text-[10px] opacity-70">({filteredPopular.length})</span>
              )}
            </button>
          </div>

          {/* Items */}
          <div className="max-h-[min(200px,40vh)] overflow-auto">
            {currentItems.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                {isFiltering
                  ? `No ${activeTab} items match "${searchQuery}"`
                  : activeTab === 'recent'
                    ? 'Roll some tables to see them here'
                    : 'Your most-used tables will appear here'}
              </div>
            ) : (
              currentItems.map((usage) => (
                <QuickAccessItem
                  key={usage.stats.id}
                  usage={usage}
                  isSelected={selectedItemId === usage.item.id}
                  showRollCount={activeTab === 'popular'}
                  onSelect={() => onSelectItem(usage.item, usage.collectionId)}
                  onRoll={() => onRollItem(usage.item, usage.collectionId)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
})

// Individual quick access item
interface QuickAccessItemProps {
  usage: EnrichedUsage
  isSelected: boolean
  showRollCount: boolean
  onSelect: () => void
  onRoll: () => void
}

const QuickAccessItem = memo(function QuickAccessItem({
  usage,
  isSelected,
  showRollCount,
  onSelect,
  onRoll,
}: QuickAccessItemProps) {
  const { item, collectionName, stats } = usage
  const Icon = getResultTypeIcon(item.resultType)

  return (
    <div
      className={`
        group flex items-center gap-2 px-3 py-2 cursor-pointer
        border-l-2 transition-all duration-150
        ${
          isSelected
            ? item.type === 'template'
              ? 'bg-[hsl(var(--lavender)/0.12)] border-l-lavender'
              : 'bg-primary/10 border-l-primary'
            : 'border-l-transparent hover:bg-white/[0.03] hover:border-l-muted-foreground/30'
        }
      `}
      onClick={onSelect}
      onDoubleClick={onRoll}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onRoll()
        } else if (e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      {/* Icon */}
      <Icon
        className={`w-4 h-4 flex-shrink-0 ${
          item.type === 'template' ? 'text-lavender' : 'text-mint'
        }`}
      />

      {/* Name and Collection */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.name}</div>
        <div className="text-[10px] text-muted-foreground truncate">{collectionName}</div>
      </div>

      {/* Stats badge */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
          {showRollCount
            ? `${stats.rollCount}x`
            : formatTimestamp(stats.lastRolled)}
        </span>

        {/* Roll button - show on hover */}
        <button
          className={`
            p-1.5 rounded-md transition-all duration-150
            opacity-0 group-hover:opacity-100
            ${isSelected
              ? item.type === 'template'
                ? 'bg-lavender/20 text-lavender hover:bg-lavender/30'
                : 'bg-primary/20 text-primary hover:bg-primary/30'
              : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'}
          `}
          onClick={(e) => {
            e.stopPropagation()
            onRoll()
          }}
          aria-label={`Roll ${item.name}`}
          title="Roll"
        >
          <Dices className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
})

export default QuickAccessSection
