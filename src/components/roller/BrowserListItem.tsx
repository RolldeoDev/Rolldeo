/**
 * BrowserListItem Component
 *
 * A single table or template row in the browser list.
 * Shows icon, name, tags, and provides click/double-click actions.
 */

import { memo } from 'react'
import { Dices, EyeOff } from 'lucide-react'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import { TableTypeIcon } from './TableTypeIcon'

interface BrowserListItemProps {
  item: BrowserItem
  isSelected: boolean
  onSelect: () => void
  onRoll: () => void
}

export const BrowserListItem = memo(function BrowserListItem({
  item,
  isSelected,
  onSelect,
  onRoll,
}: BrowserListItemProps) {
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

  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2.5 cursor-pointer
        border-l-2 transition-colors duration-150
        ${
          isSelected
            ? 'bg-primary/10 border-l-primary'
            : 'border-l-transparent hover:bg-white/5'
        }
        ${item.hidden ? 'opacity-50' : ''}
      `}
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
    >
      {/* Type Icon */}
      <TableTypeIcon
        type={item.type === 'template' ? 'template' : (item.tableType || 'simple')}
        className="w-4 h-4 flex-shrink-0"
      />

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

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
          {item.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 2 && (
            <span className="text-[10px] text-muted-foreground">
              +{item.tags.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Roll Button */}
      <button
        className={`
          p-1.5 rounded-md transition-colors duration-150
          ${isSelected ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'}
        `}
        onClick={(e) => {
          e.stopPropagation()
          onRoll()
        }}
        aria-label={`Roll ${item.name}`}
        title="Roll (or double-click)"
      >
        <Dices className="w-4 h-4" />
      </button>
    </div>
  )
})

export default BrowserListItem
