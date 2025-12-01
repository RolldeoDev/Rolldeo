/**
 * DescriptionsDrawer Component
 *
 * A slide-in drawer from the right that displays entry descriptions in a grimoire-style panel.
 * Shared between CurrentRollResult and RollHistoryList items.
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { ChevronRight, BookOpen, X, ChevronsUpDown, ChevronsDownUp, Copy, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { EntryDescription } from '@/engine/types'
import { cn } from '@/lib/utils'

interface DescriptionsDrawerProps {
  descriptions: EntryDescription[] | null
  isOpen: boolean
  onClose: () => void
  sourceLabel?: string // e.g., "Character" or table name to show what roll these descriptions are from
}

export const DescriptionsDrawer = memo(function DescriptionsDrawer({
  descriptions,
  isOpen,
  onClose,
  sourceLabel,
}: DescriptionsDrawerProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(() => new Set())
  const drawerRef = useRef<HTMLDivElement>(null)

  // Reset expanded state when descriptions change
  useEffect(() => {
    if (descriptions && descriptions.length === 1) {
      setExpandedItems(new Set([0]))
    } else {
      setExpandedItems(new Set())
    }
  }, [descriptions])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus trap and initial focus
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      drawerRef.current.focus()
    }
  }, [isOpen])

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
    if (descriptions) {
      setExpandedItems(new Set(descriptions.map((_, i) => i)))
    }
  }, [descriptions])

  const collapseAll = useCallback(() => {
    setExpandedItems(new Set())
  }, [])

  const allExpanded = descriptions ? expandedItems.size === descriptions.length : false
  const allCollapsed = expandedItems.size === 0

  if (!descriptions || descriptions.length === 0) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Descriptions"
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] max-w-full',
          'transform transition-transform duration-300 ease-out',
          'outline-none',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className={cn(
          'h-full flex flex-col overflow-hidden',
          'border-l',
          // Dark mode
          'dark:border-amber-900/30',
          'dark:bg-gradient-to-b dark:from-stone-900 dark:via-stone-900 dark:to-stone-950',
          'dark:shadow-[-8px_0_32px_rgba(0,0,0,0.5)]',
          // Light mode - solid opaque background
          'border-amber-300',
          'bg-[#fef7ed]',
          'shadow-[-8px_0_32px_rgba(0,0,0,0.15)]',
          // Subtle parchment texture overlay
          'before:absolute before:inset-0 before:opacity-[0.02] before:pointer-events-none',
          "before:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48cmVjdCB3aWR0aD0iMiIgaGVpZ2h0PSIyIiBmaWxsPSIjMDAwIi8+PC9zdmc+')]"
        )}>
          {/* Header */}
          <div className={cn(
            'flex items-center justify-between px-4 py-3 flex-shrink-0',
            'border-b',
            // Dark mode
            'dark:border-amber-900/20',
            'dark:bg-gradient-to-r dark:from-amber-950/40 dark:via-transparent dark:to-amber-950/40',
            // Light mode - solid background
            'border-amber-200',
            'bg-amber-100'
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                // Dark mode
                'dark:bg-amber-500/10 dark:border-amber-500/20',
                'dark:shadow-[0_0_12px_rgba(245,158,11,0.15)]',
                // Light mode
                'bg-amber-500/20 border border-amber-500/30',
                'shadow-[0_0_12px_rgba(245,158,11,0.1)]'
              )}>
                <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className={cn(
                  'text-base font-semibold tracking-wide',
                  'text-amber-900 dark:text-amber-100/90'
                )}>
                  Descriptions
                </h2>
                <p className="text-[11px] text-amber-700/60 dark:text-amber-200/40 font-medium tracking-wider uppercase">
                  {descriptions.length} {descriptions.length === 1 ? 'entry' : 'entries'}
                  {sourceLabel && <span className="ml-1.5">from {sourceLabel}</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Expand/Collapse All */}
              {descriptions.length > 1 && (
                <button
                  onClick={allExpanded ? collapseAll : expandAll}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs',
                    'text-amber-700/50 hover:text-amber-700/80 dark:text-amber-200/50 dark:hover:text-amber-200/80',
                    'hover:bg-amber-500/10 transition-colors duration-200'
                  )}
                  title={allExpanded ? 'Collapse all' : 'Expand all'}
                >
                  {allExpanded || allCollapsed ? (
                    <ChevronsUpDown className="w-4 h-4" />
                  ) : (
                    <ChevronsDownUp className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {allExpanded ? 'Collapse' : 'Expand'}
                  </span>
                </button>
              )}

              {/* Close */}
              <button
                onClick={onClose}
                className={cn(
                  'p-2 rounded-lg',
                  'text-amber-700/40 hover:text-amber-700/80 dark:text-amber-200/40 dark:hover:text-amber-200/80',
                  'hover:bg-amber-500/10 transition-colors duration-200'
                )}
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Description List */}
          <div className="flex-1 overflow-auto p-4 space-y-2 scroll-smooth">
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
      </div>
    </>
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
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent toggling the accordion
    try {
      await navigator.clipboard.writeText(description.description)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [description.description])

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden transition-all duration-300',
        'border',
        isExpanded
          ? 'dark:border-amber-600/30 dark:bg-gradient-to-br dark:from-amber-950/50 dark:to-stone-900/80 border-amber-300 bg-amber-50'
          : 'dark:border-stone-700/40 dark:bg-stone-800/50 dark:hover:bg-stone-800/70 dark:hover:border-stone-600/50 border-amber-200 bg-white hover:bg-amber-50 hover:border-amber-300'
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
            isExpanded ? 'rotate-90 text-amber-600 dark:text-amber-400' : 'text-amber-400 dark:text-stone-500'
          )}
        />

        <div className="flex-1 min-w-0 space-y-1">
          {/* Table name as attribution badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold',
              'tracking-wider uppercase',
              'dark:bg-amber-500/15 dark:text-amber-300/80 dark:border-amber-500/20',
              'bg-amber-500/20 text-amber-700 border border-amber-500/30'
            )}>
              {description.tableName}
            </span>
          </div>

          {/* Rolled value */}
          <p className={cn(
            'text-sm leading-snug',
            isExpanded ? 'text-amber-900 dark:text-stone-100' : 'text-amber-800 dark:text-stone-300',
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
            {/* Decorative flourish with copy button */}
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
              <span className="text-amber-600/50 dark:text-amber-500/40 text-[10px] font-serif italic">lore</span>
              <div className="h-px flex-1 bg-gradient-to-l from-amber-500/30 to-transparent" />
              <button
                onClick={handleCopy}
                className={cn(
                  'p-1 rounded transition-colors duration-200',
                  copied
                    ? 'text-green-500 dark:text-green-400'
                    : 'text-amber-400 hover:text-amber-600 dark:text-stone-500 dark:hover:text-amber-300 hover:bg-amber-500/10'
                )}
                title={copied ? 'Copied!' : 'Copy description'}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Description text with markdown */}
            <div className="prose-description text-[13px]">
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

export default DescriptionsDrawer
