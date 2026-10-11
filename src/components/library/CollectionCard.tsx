/**
 * CollectionCard Component
 *
 * Card display for a collection with metadata, tags, stats, and actions.
 * Enhanced to show author and source information when available.
 */

import { memo } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Dices, Layers, Trash2, User, BookOpen, Check, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CollectionMeta } from '@/stores/collectionStore'

const tagColors = [
  'pill-mint',
  'pill-lavender',
  'pill-amber',
]

interface CollectionCardProps {
  collection: CollectionMeta
  onDelete?: () => void
  /** Callback to hide a preloaded collection */
  onHide?: () => void
  /** Animation delay index for staggered appearance */
  index?: number
  /** Whether to show a compact version */
  compact?: boolean
  /** Whether the card is selected */
  isSelected?: boolean
  /** Callback when selection changes */
  onSelectionChange?: (id: string, selected: boolean) => void
}

export const CollectionCard = memo(function CollectionCard({
  collection,
  onDelete,
  onHide,
  index = 0,
  compact = false,
  isSelected = false,
  onSelectionChange,
}: CollectionCardProps) {
  const hasMetadata = collection.author || collection.sourceBook || collection.sourcePublisher

  return (
    <div
      className={cn(
        'card-elevated border group transition-all duration-300 hover:scale-[1.01] animate-slide-up relative',
        compact ? 'p-4' : 'p-5',
        isSelected
          ? 'border-primary/50 bg-primary/5'
          : 'border-white/5 hover:border-white/10'
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Selection Checkbox */}
      <button
        role="checkbox"
        aria-checked={isSelected}
        aria-label={isSelected ? 'Deselect collection' : 'Select collection'}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onSelectionChange?.(collection.id, !isSelected)
        }}
        className={cn(
          'absolute top-3 left-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all z-10',
          isSelected
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-white/30 hover:border-white/50 bg-black/20'
        )}
      >
        {isSelected && <Check className="h-3 w-3" />}
      </button>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3 pl-7">
        <h3 className={cn(
          'font-semibold leading-tight',
          compact ? 'text-base' : 'text-lg'
        )}>
          {collection.name}
        </h3>
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete()
            }}
            className="p-2 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded-lg transition-all -mt-1 -mr-1"
            title="Delete collection"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        )}
        {onHide && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onHide()
            }}
            className="p-2 opacity-0 group-hover:opacity-100 hover:bg-muted rounded-lg transition-all -mt-1 -mr-1"
            title="Hide collection"
          >
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Description */}
      <div className={cn(
        'text-sm text-muted-foreground line-clamp-2 prose-card',
        compact ? 'mb-3 min-h-[2rem]' : 'mb-4 min-h-[2.5rem]'
      )}>
        <ReactMarkdown
          components={{
            p: ({ children }) => <span>{children} </span>,
            h1: ({ children }) => <strong className="text-foreground">{children}: </strong>,
            h2: ({ children }) => <strong className="text-foreground">{children}: </strong>,
            h3: ({ children }) => <strong className="text-foreground">{children}: </strong>,
            strong: ({ children }) => <strong className="font-semibold text-foreground/90">{children}</strong>,
            em: ({ children }) => <em>{children}</em>,
            code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{children}</code>,
            a: ({ href, children }) => (
              <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            ul: ({ children }) => <span>{children}</span>,
            ol: ({ children }) => <span>{children}</span>,
            li: ({ children }) => <span>• {children} </span>,
            blockquote: ({ children }) => <span className="italic">{children}</span>,
          }}
        >
          {collection.description || `Collection with ${collection.tableCount} tables`}
        </ReactMarkdown>
      </div>

      {/* Author & Source metadata */}
      {hasMetadata && !compact && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3 pb-3 border-b border-white/5">
          {collection.author && (
            <span className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-copper/60" />
              <span className="truncate max-w-[120px]">{collection.author}</span>
            </span>
          )}
          {(collection.sourceBook || collection.sourcePublisher) && (
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-lavender/60" />
              <span className="truncate max-w-[150px]">
                {collection.sourceBook || collection.sourcePublisher}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      <div className={cn(
        'flex flex-wrap gap-1.5',
        compact ? 'mb-3 min-h-[1.5rem]' : 'mb-4 min-h-[1.75rem]'
      )}>
        {collection.tags.slice(0, compact ? 2 : 3).map((tag, tagIndex) => (
          <span
            key={tag}
            className={cn('pill', tagColors[tagIndex % tagColors.length])}
          >
            {tag}
          </span>
        ))}
        {collection.tags.length > (compact ? 2 : 3) && (
          <span className="pill pill-outline">
            +{collection.tags.length - (compact ? 2 : 3)}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className={cn(
        'flex items-center gap-4 text-xs text-muted-foreground border-b border-white/5',
        compact ? 'mb-3 pb-3' : 'mb-4 pb-4'
      )}>
        <span className="flex items-center gap-1.5">
          <Dices className="h-3.5 w-3.5" />
          {collection.tableCount} table{collection.tableCount !== 1 ? 's' : ''}
        </span>
        {collection.templateCount > 0 && (
          <span className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {collection.templateCount} template{collection.templateCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          to={`/roll?collection=${collection.id}`}
          className={cn(
            'flex-1 btn-primary flex items-center justify-center gap-2 text-sm',
            compact ? 'py-2' : 'py-2.5'
          )}
        >
          <Dices className="h-4 w-4" />
          Roll
        </Link>
        <Link
          to={`/editor/${collection.id}`}
          className={cn(
            'flex-1 btn-secondary flex items-center justify-center text-sm',
            compact ? 'py-2' : 'py-2.5'
          )}
        >
          View
        </Link>
      </div>
    </div>
  )
})

export default CollectionCard
