/**
 * DescriptionsDrawer Component
 *
 * A slide-in drawer from the right that displays entry descriptions.
 * Uses CSS classes for theming to support multiple result themes.
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { ChevronRight, BookOpen, X, ChevronsUpDown, ChevronsDownUp, Copy, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { EntryDescription } from '@/engine/types'
import { useUIStore, type ResultTheme } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

interface DescriptionsDrawerProps {
  descriptions: EntryDescription[] | null
  isOpen: boolean
  onClose: () => void
  sourceLabel?: string
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
  const isThemedResult = resultTheme !== 'default'

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
          'h-full flex flex-col overflow-hidden border-l',
          isThemedResult ? `drawer-${resultTheme}` : 'drawer-default'
        )}>
          {/* Header */}
          <div className={cn(
            'flex items-center justify-between px-4 py-3 flex-shrink-0 border-b',
            isThemedResult ? `drawer-header-${resultTheme}` : 'drawer-header-default'
          )}>
            <div className="flex items-center gap-3">
              <div className="icon-container icon-copper">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-wide text-copper dark:text-copper">
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
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-copper/50 hover:text-copper/80 hover:bg-copper/10 transition-colors duration-200"
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
                className="p-2 rounded-lg text-copper/40 hover:text-copper/80 hover:bg-copper/10 transition-colors duration-200"
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
                resultTheme={resultTheme}
                isThemedResult={isThemedResult}
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
  resultTheme: ResultTheme
  isThemedResult: boolean
}

const DescriptionEntry = memo(function DescriptionEntry({
  description,
  isExpanded,
  onToggle,
  index,
  resultTheme,
  isThemedResult,
}: DescriptionEntryProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
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
        'overflow-hidden transition-all duration-300 border rounded-lg',
        isThemedResult
          ? `drawer-entry-${resultTheme}`
          : 'drawer-entry-default',
        isExpanded && 'drawer-entry-expanded'
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Entry Header - clickable to expand */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors duration-200"
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
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase dark:bg-copper/15 dark:text-copper dark:border-copper/25 bg-copper/20 text-copper border border-copper/30">
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
          <div className="px-3 pb-3 pt-1 ml-7 border-l-2 border-copper/30">
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
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Description text with markdown - uses theme prose classes */}
            <div className={cn(
              "text-[13px]",
              isThemedResult ? `prose-roll-${resultTheme}` : "prose-description"
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
