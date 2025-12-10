/**
 * BrowserListItem Component
 *
 * A single table or template row in the browser list.
 * Shows icon, name, tags, and provides click/double-click actions.
 * Supports right-click context menu for additional actions.
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Dices, EyeOff, Pencil, ClipboardCopy, Hash, Info, Star } from 'lucide-react'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import { getResultTypeIcon } from '@/lib/resultTypeIcons'
import { ContextMenu, type ContextMenuEntry } from './ContextMenu'
import { FavoriteButton } from '@/components/common/FavoriteButton'
import { useFavoriteStore } from '@/stores/favoriteStore'

interface BrowserListItemProps {
  item: BrowserItem
  collectionId: string
  isSelected: boolean
  onSelect: () => void
  onRoll: () => void
  onEdit?: () => void
  onCopyResult?: () => void
  onRollMultiple?: () => void
  onViewDetails?: () => void
}

export const BrowserListItem = memo(function BrowserListItem({
  item,
  collectionId,
  isSelected,
  onSelect,
  onRoll,
  onEdit,
  onCopyResult,
  onRollMultiple,
  onViewDetails,
}: BrowserListItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const isFavorite = useFavoriteStore((state) =>
    state.isFavorite(collectionId, item.id, item.type)
  )
  const toggleFavorite = useFavoriteStore((state) => state.toggleFavorite)
  const [showTagsTooltip, setShowTagsTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const tagsButtonRef = useRef<HTMLButtonElement>(null)

  // Update tooltip position when showing
  useEffect(() => {
    if (showTagsTooltip && tagsButtonRef.current) {
      const rect = tagsButtonRef.current.getBoundingClientRect()
      setTooltipPosition({
        x: rect.right,
        y: rect.bottom + 4,
      })
    }
  }, [showTagsTooltip])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onRoll()
    } else if (e.key === ' ') {
      e.preventDefault()
      onSelect()
    }
  }

  const handleDoubleClick = () => {
    onRoll()
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Build context menu items
  const contextMenuItems: ContextMenuEntry[] = [
    {
      id: 'roll',
      label: 'Roll',
      icon: Dices,
      onClick: onRoll,
    },
    {
      id: 'favorite',
      label: isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
      icon: Star,
      onClick: () => toggleFavorite(collectionId, item.id, item.type),
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: onEdit || (() => {}),
      disabled: !onEdit,
    },
    { type: 'divider' },
    {
      id: 'copy-result',
      label: 'Copy Result',
      icon: ClipboardCopy,
      onClick: onCopyResult || (() => {}),
      disabled: !onCopyResult,
    },
    {
      id: 'roll-multiple',
      label: 'Roll Multiple...',
      icon: Hash,
      onClick: onRollMultiple || (() => {}),
      disabled: !onRollMultiple,
    },
    { type: 'divider' },
    {
      id: 'view-details',
      label: 'View Details',
      icon: Info,
      onClick: onViewDetails || (() => {}),
      disabled: !onViewDetails,
    },
  ]

  return (
    <>
    <div
      className={`
        group flex items-center gap-3 px-3 py-2.5 cursor-pointer
        border-l-2 transition-all duration-150
        ${
          isSelected
            ? item.type === 'template'
              ? 'bg-[hsl(var(--lavender)/0.12)] border-l-lavender'
              : 'bg-primary/10 border-l-primary'
            : 'border-l-transparent hover:bg-white/[0.03] hover:border-l-muted-foreground/30'
        }
        ${item.hidden ? 'opacity-50' : ''}
      `}
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
    >
      {/* Result Type Icon */}
      {(() => {
        const Icon = getResultTypeIcon(item.resultType)
        return (
          <Icon
            className={`w-4 h-4 flex-shrink-0 ${
              item.type === 'template' ? 'text-lavender' : 'text-mint'
            }`}
          />
        )
      })()}

      {/* Name and Description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.name}</span>
          {item.hidden && (
            <EyeOff className="w-3 h-3 text-muted-foreground flex-shrink-0" aria-label="Hidden" />
          )}
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {item.description}
          </p>
        )}
      </div>

      {/* Action Buttons - show on hover or when selected */}
      <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity duration-150 ${
        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        {/* Favorite Button */}
        <FavoriteButton
          collectionId={collectionId}
          itemId={item.id}
          type={item.type}
          size="sm"
        />

        {/* Tags Info Icon */}
        {item.tags && item.tags.length > 0 && (
          <>
            <button
              ref={tagsButtonRef}
              className="p-1.5 rounded-md transition-colors duration-150 text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5"
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setShowTagsTooltip(true)}
              onMouseLeave={() => setShowTagsTooltip(false)}
              aria-label={`Tags: ${item.tags.join(', ')}`}
              title="View tags"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            {/* Tags Tooltip Portal */}
            {showTagsTooltip && tooltipPosition && createPortal(
              <div
                className="fixed z-[9999] pointer-events-none"
                style={{
                  left: tooltipPosition.x,
                  top: tooltipPosition.y,
                  transform: 'translateX(-100%)',
                }}
              >
                <div className="bg-popover border border-border rounded-md shadow-lg px-2 py-1.5 min-w-max max-w-48">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-muted-foreground border border-white/10"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>,
              document.body
            )}
          </>
        )}

        {/* Roll Button */}
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
          title="Roll (double-click or Enter)"
        >
          <Dices className="w-4 h-4" />
        </button>
      </div>
    </div>

    {/* Context Menu */}
    {contextMenu && (
      <ContextMenu
        items={contextMenuItems}
        position={contextMenu}
        onClose={closeContextMenu}
      />
    )}
    </>
  )
})

export default BrowserListItem
