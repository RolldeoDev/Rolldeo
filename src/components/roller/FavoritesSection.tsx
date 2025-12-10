/**
 * FavoritesSection Component
 *
 * Collapsible section showing favorite tables/templates for quick access.
 * Appears at the top of the BrowserPanel.
 */

import { memo, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight, Star, Dices } from 'lucide-react'
import { useFavoriteStore } from '@/stores/favoriteStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useUIStore } from '@/stores/uiStore'
import { getResultTypeIcon } from '@/lib/resultTypeIcons'
import { FavoriteButton } from '@/components/common/FavoriteButton'
import type { BrowserItem } from '@/hooks/useBrowserFilter'

interface FavoritesSectionProps {
  selectedItemId: string | null
  onSelectItem: (item: BrowserItem, collectionId: string) => void
  onRollItem: (item: BrowserItem, collectionId: string) => void
  searchQuery?: string
}

interface EnrichedFavorite {
  id: string
  collectionId: string
  item: BrowserItem
  collectionName: string
}

export const FavoritesSection = memo(function FavoritesSection({
  selectedItemId,
  onSelectItem,
  onRollItem,
  searchQuery = '',
}: FavoritesSectionProps) {
  // Use store state for expanded instead of local state
  const isExpanded = useUIStore((state) => state.isFavoritesSectionExpanded)
  const setFavoritesSectionExpanded = useUIStore((state) => state.setFavoritesSectionExpanded)

  // Subscribe to raw state Maps to trigger re-renders when data changes
  // (Don't call getFavorites() in selector - creates new array every time)
  const favoritesMap = useFavoriteStore((state) => state.favorites)
  const collectionsMap = useCollectionStore((state) => state.collections)

  // Enrich favorites with item metadata and filter out invalid ones
  // Use getState() to access functions inside useMemo
  const enrichedFavorites = useMemo((): EnrichedFavorite[] => {
    // Get sorted favorites from Map
    const favorites = Array.from(favoritesMap.values()).sort((a, b) => a.sortOrder - b.sortOrder)
    const { getCollection, getTableList, getTemplateList } = useCollectionStore.getState()

    const result: EnrichedFavorite[] = []

    for (const fav of favorites) {
      const collection = getCollection(fav.collectionId)
      if (!collection) continue

      let item: BrowserItem | undefined

      if (fav.type === 'table') {
        const tables = getTableList(fav.collectionId)
        const table = tables.find((t) => t.id === fav.itemId)
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
        const templates = getTemplateList(fav.collectionId)
        const template = templates.find((t) => t.id === fav.itemId)
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
          id: fav.id,
          collectionId: fav.collectionId,
          item,
          collectionName: collection.name,
        })
      }
    }

    return result
  }, [favoritesMap, collectionsMap]) // No function deps - use getState() inside

  // Filter by search query
  const filteredFavorites = useMemo(() => {
    if (!searchQuery.trim()) return enrichedFavorites

    const query = searchQuery.toLowerCase()
    return enrichedFavorites.filter((fav) => {
      // Match against item name, description, or collection name
      const nameMatch = fav.item.name.toLowerCase().includes(query)
      const descMatch = fav.item.description?.toLowerCase().includes(query)
      const collectionMatch = fav.collectionName.toLowerCase().includes(query)
      return nameMatch || descMatch || collectionMatch
    })
  }, [enrichedFavorites, searchQuery])

  const handleToggle = useCallback(() => {
    setFavoritesSectionExpanded(!isExpanded)
  }, [setFavoritesSectionExpanded, isExpanded])

  // Don't render if no favorites at all
  if (enrichedFavorites.length === 0) {
    return null
  }

  // Check if we're filtering and have results
  const isFiltering = searchQuery.trim().length > 0
  const hasFilteredResults = filteredFavorites.length > 0

  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight

  return (
    <div className="border-b border-white/5">
      {/* Header */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2.5 cursor-pointer
          transition-colors duration-150
          ${isExpanded ? 'bg-amber/3' : 'hover:bg-white/5'}
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
        <ChevronIcon className={`w-4 h-4 ${isExpanded ? 'text-amber' : 'text-muted-foreground'}`} />
        <Star className="w-4 h-4 text-amber fill-amber" />
        <span className="flex-1 text-sm font-medium">Favorites</span>
        <span className="text-xs text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
          {isFiltering ? `${filteredFavorites.length}/${enrichedFavorites.length}` : enrichedFavorites.length}
        </span>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="max-h-[min(200px,40vh)] overflow-auto bg-background/50">
          {hasFilteredResults ? (
            filteredFavorites.map((fav) => (
              <FavoriteItem
                key={fav.id}
                favorite={fav}
                isSelected={selectedItemId === fav.item.id}
                onSelect={() => onSelectItem(fav.item, fav.collectionId)}
                onRoll={() => onRollItem(fav.item, fav.collectionId)}
              />
            ))
          ) : (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No favorites match "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// Individual favorite item
interface FavoriteItemProps {
  favorite: EnrichedFavorite
  isSelected: boolean
  onSelect: () => void
  onRoll: () => void
}

const FavoriteItem = memo(function FavoriteItem({
  favorite,
  isSelected,
  onSelect,
  onRoll,
}: FavoriteItemProps) {
  const { item, collectionId, collectionName } = favorite
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

      {/* Actions */}
      <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity duration-150 ${
        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        <FavoriteButton
          collectionId={collectionId}
          itemId={item.id}
          type={item.type}
          size="sm"
        />
        <button
          className={`
            p-1.5 rounded-md transition-all duration-150
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

export default FavoritesSection
