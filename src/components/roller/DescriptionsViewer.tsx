/**
 * DescriptionsViewer Component
 *
 * Displays entry descriptions from a roll result in a grimoire-style panel.
 * Each description appears like an entry in a magical tome, with attribution
 * to the source table and the rolled value.
 */

import { memo, useState, useCallback } from 'react'
import { ChevronRight, BookOpen, X, ChevronsUpDown, ChevronsDownUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { EntryDescription } from '@/engine/types'
import { cn } from '@/lib/utils'

interface DescriptionsViewerProps {
  descriptions: EntryDescription[]
  onClose: () => void
}

export const DescriptionsViewer = memo(function DescriptionsViewer({
  descriptions,
  onClose,
}: DescriptionsViewerProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(() => {
    // Auto-expand first item if only one description
    return descriptions.length === 1 ? new Set([0]) : new Set()
  })

  const toggleItem = useCallback((index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpandedItems(new Set(descriptions.map((_, i) => i)))
  }, [descriptions])

  const collapseAll = useCallback(() => {
    setExpandedItems(new Set())
  }, [])

  const allExpanded = expandedItems.size === descriptions.length
  const allCollapsed = expandedItems.size === 0

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl',
      'border border-amber-900/30',
      'bg-gradient-to-b from-stone-900/95 via-stone-900/90 to-stone-950/95',
      'shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03)]',
      // Subtle parchment texture overlay
      'before:absolute before:inset-0 before:opacity-[0.015] before:pointer-events-none',
      "before:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48cmVjdCB3aWR0aD0iMiIgaGVpZ2h0PSIyIiBmaWxsPSIjMDAwIi8+PC9zdmc+')]"
    )}>
      {/* Header - styled like a book section header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3',
        'border-b border-amber-900/20',
        'bg-gradient-to-r from-amber-950/40 via-transparent to-amber-950/40'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-1.5 rounded-lg',
            'bg-amber-500/10 border border-amber-500/20',
            'shadow-[0_0_12px_rgba(245,158,11,0.15)]'
          )}>
            <BookOpen className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className={cn(
              'text-sm font-semibold tracking-wide',
              'text-amber-100/90'
            )}>
              Descriptions
            </h3>
            <p className="text-[10px] text-amber-200/40 font-medium tracking-wider uppercase">
              {descriptions.length} {descriptions.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Expand/Collapse All */}
          <button
            onClick={allExpanded ? collapseAll : expandAll}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
              'text-amber-200/50 hover:text-amber-200/80',
              'hover:bg-amber-500/10 transition-colors duration-200'
            )}
            title={allExpanded ? 'Collapse all' : 'Expand all'}
          >
            {allExpanded || allCollapsed ? (
              <ChevronsUpDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronsDownUp className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {allExpanded ? 'Collapse' : 'Expand'}
            </span>
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className={cn(
              'p-1.5 rounded-md',
              'text-amber-200/40 hover:text-amber-200/80',
              'hover:bg-amber-500/10 transition-colors duration-200'
            )}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Description List */}
      <div className="max-h-[400px] overflow-auto p-3 space-y-2 scroll-smooth">
        {descriptions.map((desc, index) => (
          <DescriptionEntry
            key={`${desc.tableId}-${index}`}
            description={desc}
            isExpanded={expandedItems.has(index)}
            onToggle={() => toggleItem(index)}
            index={index}
          />
        ))}
      </div>
    </div>
  )
})

interface DescriptionEntryProps {
  description: EntryDescription
  isExpanded: boolean
  onToggle: () => void
  index: number
}

const DescriptionEntry = memo(function DescriptionEntry({
  description,
  isExpanded,
  onToggle,
  index,
}: DescriptionEntryProps) {
  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden transition-all duration-300',
        'border',
        isExpanded
          ? 'border-amber-600/30 bg-gradient-to-br from-amber-950/40 to-stone-950/60'
          : 'border-stone-700/30 bg-stone-800/30 hover:bg-stone-800/50 hover:border-stone-600/40'
      )}
      style={{
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* Entry Header - clickable to expand */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-start gap-3 px-3 py-2.5 text-left',
          'transition-colors duration-200'
        )}
      >
        {/* Chevron indicator */}
        <ChevronRight
          className={cn(
            'w-4 h-4 mt-0.5 flex-shrink-0 transition-transform duration-300',
            isExpanded ? 'rotate-90 text-amber-400' : 'text-stone-500'
          )}
        />

        <div className="flex-1 min-w-0 space-y-1">
          {/* Table name as attribution badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold',
              'tracking-wider uppercase',
              'bg-amber-500/15 text-amber-300/80 border border-amber-500/20'
            )}>
              {description.tableName}
            </span>
          </div>

          {/* Rolled value */}
          <p className={cn(
            'text-sm leading-snug',
            isExpanded ? 'text-stone-100' : 'text-stone-300',
            !isExpanded && 'line-clamp-2'
          )}>
            {description.rolledValue}
          </p>
        </div>
      </button>

      {/* Expanded Description Content */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-out',
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className={cn(
            'px-3 pb-3 pt-1 ml-7',
            'border-l-2 border-amber-500/30'
          )}>
            {/* Decorative flourish */}
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
              <span className="text-amber-500/40 text-[10px] font-serif italic">lore</span>
              <div className="h-px flex-1 bg-gradient-to-l from-amber-500/30 to-transparent" />
            </div>

            {/* Description text with markdown */}
            <div className={cn(
              'prose prose-sm prose-invert max-w-none',
              // Custom prose styling for grimoire feel
              'prose-p:text-stone-300 prose-p:leading-relaxed prose-p:my-2',
              'prose-strong:text-amber-200 prose-strong:font-semibold',
              'prose-em:text-stone-200 prose-em:font-serif prose-em:not-italic',
              'prose-ul:my-2 prose-li:text-stone-300 prose-li:marker:text-amber-500/50',
              'prose-ol:my-2',
              'prose-headings:text-amber-100 prose-headings:font-medium',
              'prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline',
              'prose-blockquote:border-l-amber-500/40 prose-blockquote:bg-stone-800/30',
              'prose-blockquote:text-stone-400 prose-blockquote:not-italic prose-blockquote:py-1',
              'prose-code:text-amber-300 prose-code:bg-stone-800/50 prose-code:px-1 prose-code:rounded',
              'prose-pre:bg-stone-900/80 prose-pre:border prose-pre:border-stone-700/50',
              // Typography refinements
              '[&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
              'text-[13px]'
            )}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {description.description}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default DescriptionsViewer
