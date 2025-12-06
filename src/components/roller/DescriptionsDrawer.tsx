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
import { useUIStore } from '@/stores/uiStore'
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
  const resultTheme = useUIStore((state) => state.resultTheme)
  const isTtrpg = resultTheme === 'ttrpg'

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
          isTtrpg ? (
            // TTRPG theme - parchment style
            cn(
              'dark:border-[hsl(35,45%,35%)]',
              'dark:bg-gradient-to-b dark:from-[hsl(30,25%,18%)] dark:via-[hsl(28,22%,15%)] dark:to-[hsl(26,20%,12%)]',
              'dark:shadow-[-8px_0_32px_rgba(0,0,0,0.5)]',
              'border-[hsl(30,40%,55%)]',
              'bg-gradient-to-b from-[hsl(40,45%,94%)] via-[hsl(39,42%,91%)] to-[hsl(38,40%,88%)]',
              'shadow-[-8px_0_32px_rgba(0,0,0,0.15)]',
              // Parchment texture overlay
              'before:absolute before:inset-0 before:opacity-[0.03] before:pointer-events-none',
              "before:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48cmVjdCB3aWR0aD0iMiIgaGVpZ2h0PSIyIiBmaWxsPSIjMDAwIi8+PC9zdmc+')]"
            )
          ) : (
            // Default copper theme
            cn(
              'dark:border-copper/30',
              'dark:bg-gradient-to-b dark:from-stone-900 dark:via-stone-900 dark:to-stone-950',
              'dark:shadow-[-8px_0_32px_rgba(0,0,0,0.5)]',
              'border-copper/40',
              'bg-[#fdf6f0]',
              'shadow-[-8px_0_32px_rgba(0,0,0,0.15)]',
              // Subtle texture overlay
              'before:absolute before:inset-0 before:opacity-[0.02] before:pointer-events-none',
              "before:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48cmVjdCB3aWR0aD0iMiIgaGVpZ2h0PSIyIiBmaWxsPSIjMDAwIi8+PC9zdmc+')]"
            )
          )
        )}>
          {/* Header */}
          <div className={cn(
            'flex items-center justify-between px-4 py-3 flex-shrink-0',
            'border-b',
            isTtrpg ? (
              // TTRPG theme header
              cn(
                'dark:border-[hsl(35,45%,30%)]',
                'dark:bg-gradient-to-r dark:from-[hsl(35,40%,22%)] dark:via-transparent dark:to-[hsl(35,40%,22%)]',
                'border-[hsl(30,40%,60%)]',
                'bg-[hsl(35,35%,82%)]'
              )
            ) : (
              // Default copper theme header
              cn(
                'dark:border-copper/20',
                'dark:bg-gradient-to-r dark:from-copper/15 dark:via-transparent dark:to-copper/15',
                'border-copper/25',
                'bg-copper/10'
              )
            )
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                // Dark mode - copper glow
                'dark:bg-copper/15 dark:border-copper/25',
                'dark:shadow-[0_0_12px_hsl(var(--copper-glow)/0.2)]',
                // Light mode - copper accent
                'bg-copper/20 border border-copper/30',
                'shadow-[0_0_12px_hsl(var(--copper-glow)/0.15)]'
              )}>
                <BookOpen className="w-5 h-5 text-copper" />
              </div>
              <div>
                <h2 className={cn(
                  'text-base font-semibold tracking-wide',
                  'text-copper dark:text-copper'
                )}>
                  Descriptions
                </h2>
                <p className="text-[11px] text-copper/60 dark:text-copper/50 font-medium tracking-wider uppercase">
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
                    'text-copper/50 hover:text-copper/80 dark:text-copper/50 dark:hover:text-copper/80',
                    'hover:bg-copper/10 transition-colors duration-200'
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
                  'text-copper/40 hover:text-copper/80 dark:text-copper/40 dark:hover:text-copper/80',
                  'hover:bg-copper/10 transition-colors duration-200'
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
                isTtrpg={isTtrpg}
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
  isTtrpg: boolean
}

const DescriptionEntry = memo(function DescriptionEntry({
  description,
  isExpanded,
  onToggle,
  index,
  isTtrpg,
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
        'overflow-hidden transition-all duration-300',
        'border',
        isTtrpg ? (
          // TTRPG parchment style
          cn(
            'rounded',
            isExpanded
              ? 'dark:border-[hsl(35,45%,35%)] dark:bg-gradient-to-br dark:from-[hsl(35,40%,22%)] dark:to-[hsl(28,22%,14%)] border-[hsl(30,40%,55%)] bg-[hsl(42,40%,90%)]'
              : 'dark:border-[hsl(30,30%,25%)] dark:bg-[hsl(28,22%,16%)] dark:hover:bg-[hsl(30,25%,18%)] dark:hover:border-[hsl(35,45%,35%)] border-[hsl(32,35%,65%)] bg-[hsl(42,35%,94%)] hover:bg-[hsl(42,40%,90%)] hover:border-[hsl(30,40%,55%)]'
          )
        ) : (
          // Default copper style
          cn(
            'rounded-lg',
            isExpanded
              ? 'dark:border-copper/30 dark:bg-gradient-to-br dark:from-copper/20 dark:to-stone-900/80 border-copper/40 bg-copper/10'
              : 'dark:border-stone-700/40 dark:bg-stone-800/50 dark:hover:bg-stone-800/70 dark:hover:border-copper/30 border-copper/20 bg-white hover:bg-copper/5 hover:border-copper/30'
          )
        )
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
            isExpanded ? 'rotate-90 text-copper' : 'text-copper/50 dark:text-stone-500'
          )}
        />

        <div className="flex-1 min-w-0 space-y-1">
          {/* Table name as attribution badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold',
              'tracking-wider uppercase',
              'dark:bg-copper/15 dark:text-copper dark:border-copper/25',
              'bg-copper/20 text-copper border border-copper/30'
            )}>
              {description.tableName}
            </span>
          </div>

          {/* Rolled value */}
          <p className={cn(
            'text-sm leading-snug',
            isExpanded ? 'text-foreground dark:text-stone-100' : 'text-foreground/80 dark:text-stone-300',
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
            'border-l-2 border-copper/30'
          )}>
            {/* Decorative flourish with copy button */}
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-gradient-to-r from-copper/30 to-transparent" />
              <span className="text-copper/50 dark:text-copper/40 text-[10px] font-serif italic">lore</span>
              <div className="h-px flex-1 bg-gradient-to-l from-copper/30 to-transparent" />
              <button
                onClick={handleCopy}
                className={cn(
                  'p-1 rounded transition-colors duration-200',
                  copied
                    ? 'text-green-500 dark:text-green-400'
                    : 'text-copper/50 hover:text-copper dark:text-stone-500 dark:hover:text-copper hover:bg-copper/10'
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
            <div className={cn(
              "text-[13px]",
              isTtrpg ? "prose-roll-ttrpg" : "prose-description"
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

export default DescriptionsDrawer
