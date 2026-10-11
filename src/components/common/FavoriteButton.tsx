/**
 * FavoriteButton Component
 *
 * A star icon toggle button for adding/removing items from favorites.
 * Can be used in BrowserListItem, SelectedItemInfo, and context menus.
 */

import { memo } from 'react'
import { Star } from 'lucide-react'
import { useFavoriteStore } from '@/stores/favoriteStore'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  collectionId: string
  itemId: string
  type: 'table' | 'template'
  /** Size variant */
  size?: 'sm' | 'md'
  /** Additional class names */
  className?: string
  /** Stop click propagation (useful in list items) */
  stopPropagation?: boolean
}

export const FavoriteButton = memo(function FavoriteButton({
  collectionId,
  itemId,
  type,
  size = 'sm',
  className,
  stopPropagation = true,
}: FavoriteButtonProps) {
  const isFavorite = useFavoriteStore((state) =>
    state.isFavorite(collectionId, itemId, type)
  )
  const toggleFavorite = useFavoriteStore((state) => state.toggleFavorite)

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation()
    }
    toggleFavorite(collectionId, itemId, type)
  }

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  const buttonPadding = size === 'sm' ? 'p-1.5' : 'p-2'

  return (
    <button
      className={cn(
        buttonPadding,
        'rounded-md transition-all duration-150',
        isFavorite
          ? 'text-amber bg-amber/20 hover:bg-amber/30'
          : 'text-muted-foreground/50 hover:text-amber hover:bg-white/5',
        className
      )}
      onClick={handleClick}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star
        className={cn(iconSize, isFavorite && 'fill-current')}
      />
    </button>
  )
})

export default FavoriteButton
