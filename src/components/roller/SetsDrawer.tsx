/**
 * SetsDrawer Component
 *
 * A slide-in drawer from the right that displays placeholder sets (key-value pairs).
 * Similar to DescriptionsDrawer but with mint color scheme and entries expanded by default.
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { ChevronRight, ListOrdered, X, ChevronsUpDown, ChevronsDownUp, Copy, Check } from 'lucide-react'
import type { EvaluatedSets, CaptureItem } from '@/engine/types'
import { cn } from '@/lib/utils'

interface SetsDrawerProps {
  sets: EvaluatedSets | null
  isOpen: boolean
  onClose: () => void
  sourceLabel?: string
}

/** Helper to get display value from a set entry (handles both string and CaptureItem) */
const getDisplayValue = (value: string | CaptureItem): string => {
  return typeof value === 'string' ? value : value.value
}

export const SetsDrawer = memo(function SetsDrawer({
  sets,
  isOpen,
  onClose,
  sourceLabel,
}: SetsDrawerProps) {
  const setKeys = sets ? Object.keys(sets) : []
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set(setKeys))
  const drawerRef = useRef<HTMLDivElement>(null)

  // Reset expanded state when sets change - default to all expanded
  useEffect(() => {
    if (sets) {
      setExpandedItems(new Set(Object.keys(sets)))
    } else {
      setExpandedItems(new Set())
    }
  }, [sets])

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

  const toggleItem = useCallback((key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    if (sets) {
      setExpandedItems(new Set(Object.keys(sets)))
    }
  }, [sets])

  const collapseAll = useCallback(() => {
    setExpandedItems(new Set())
  }, [])

  const allExpanded = sets ? expandedItems.size === Object.keys(sets).length : false
  const allCollapsed = expandedItems.size === 0

  // Copy all sets in @key: value format
  const [copiedAll, setCopiedAll] = useState(false)
  const handleCopyAll = useCallback(async () => {
    if (!sets) return
    try {
      const text = Object.entries(sets)
        .map(([key, value]) => `@${key}: ${getDisplayValue(value)}`)
        .join('\n')
      await navigator.clipboard.writeText(text)
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [sets])

  if (!sets || setKeys.length === 0) {
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
        aria-label="Sets"
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
          // Dark mode - rose theme
          'dark:border-rose/30',
          'dark:bg-gradient-to-b dark:from-stone-900 dark:via-stone-900 dark:to-stone-950',
          'dark:shadow-[-8px_0_32px_rgba(0,0,0,0.5)]',
          // Light mode - warm rose-tinted background
          'border-rose/40',
          'bg-[#fdf6f8]',
          'shadow-[-8px_0_32px_rgba(0,0,0,0.15)]',
          // Subtle texture overlay
          'before:absolute before:inset-0 before:opacity-[0.02] before:pointer-events-none',
          "before:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48cmVjdCB3aWR0aD0iMiIgaGVpZ2h0PSIyIiBmaWxsPSIjMDAwIi8+PC9zdmc+')]"
        )}>
          {/* Header */}
          <div className={cn(
            'flex items-center justify-between px-4 py-3 flex-shrink-0',
            'border-b',
            // Dark mode - rose theme
            'dark:border-rose/20',
            'dark:bg-gradient-to-r dark:from-rose/15 dark:via-transparent dark:to-rose/15',
            // Light mode - rose background
            'border-rose/25',
            'bg-rose/10'
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                // Dark mode - rose glow
                'dark:bg-rose/15 dark:border-rose/25',
                'dark:shadow-[0_0_12px_hsl(var(--rose)/0.2)]',
                // Light mode - rose accent
                'bg-rose/20 border border-rose/30',
                'shadow-[0_0_12px_hsl(var(--rose)/0.15)]'
              )}>
                <ListOrdered className="w-5 h-5 text-rose" />
              </div>
              <div>
                <h2 className={cn(
                  'text-base font-semibold tracking-wide',
                  'text-rose dark:text-rose'
                )}>
                  Sets
                </h2>
                <p className="text-[11px] text-rose/60 dark:text-rose/50 font-medium tracking-wider uppercase">
                  {setKeys.length} {setKeys.length === 1 ? 'value' : 'values'}
                  {sourceLabel && <span className="ml-1.5">from {sourceLabel}</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Copy All */}
              <button
                onClick={handleCopyAll}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs',
                  copiedAll
                    ? 'text-green-500 dark:text-green-400'
                    : 'text-rose/50 hover:text-rose/80 dark:text-rose/50 dark:hover:text-rose/80',
                  'hover:bg-rose/10 transition-colors duration-200'
                )}
                title={copiedAll ? 'Copied!' : 'Copy all sets'}
              >
                {copiedAll ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {copiedAll ? 'Copied' : 'Copy All'}
                </span>
              </button>

              {/* Expand/Collapse All */}
              {setKeys.length > 1 && (
                <button
                  onClick={allExpanded ? collapseAll : expandAll}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs',
                    'text-rose/50 hover:text-rose/80 dark:text-rose/50 dark:hover:text-rose/80',
                    'hover:bg-rose/10 transition-colors duration-200'
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
                  'text-rose/40 hover:text-rose/80 dark:text-rose/40 dark:hover:text-rose/80',
                  'hover:bg-rose/10 transition-colors duration-200'
                )}
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sets List */}
          <div className="flex-1 overflow-auto p-4 space-y-2 scroll-smooth">
            {setKeys.map((key, index) => (
              <SetEntry
                key={key}
                setKey={key}
                value={sets[key]}
                isExpanded={expandedItems.has(key)}
                onToggle={() => toggleItem(key)}
                index={index}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
})

interface SetEntryProps {
  setKey: string
  value: string | CaptureItem
  isExpanded: boolean
  onToggle: () => void
  index: number
}

const SetEntry = memo(function SetEntry({
  setKey,
  value,
  isExpanded,
  onToggle,
  index,
}: SetEntryProps) {
  const [copied, setCopied] = useState(false)
  const displayValue = getDisplayValue(value)

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(`@${setKey}: ${displayValue}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [setKey, displayValue])

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden transition-all duration-300',
        'border',
        isExpanded
          ? 'dark:border-rose/30 dark:bg-gradient-to-br dark:from-rose/20 dark:to-stone-900/80 border-rose/40 bg-rose/10'
          : 'dark:border-stone-700/40 dark:bg-stone-800/50 dark:hover:bg-stone-800/70 dark:hover:border-rose/30 border-rose/20 bg-white hover:bg-rose/5 hover:border-rose/30'
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
            isExpanded ? 'rotate-90 text-rose' : 'text-rose/50 dark:text-stone-500'
          )}
        />

        <div className="flex-1 min-w-0 space-y-1">
          {/* Key as badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold',
              'tracking-wider uppercase font-mono',
              'dark:bg-rose/15 dark:text-rose dark:border-rose/25',
              'bg-rose/20 text-rose border border-rose/30'
            )}>
              @{setKey}
            </span>
          </div>

          {/* Value preview */}
          <p className={cn(
            'text-sm leading-snug font-mono',
            isExpanded ? 'text-foreground dark:text-stone-100' : 'text-foreground/80 dark:text-stone-300',
            !isExpanded && 'line-clamp-1'
          )}>
            {displayValue}
          </p>
        </div>
      </button>

      {/* Expanded Content */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-out',
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className={cn(
            'px-3 pb-3 pt-1 ml-7',
            'border-l-2 border-rose/30'
          )}>
            {/* Copy button row */}
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-gradient-to-r from-rose/30 to-transparent" />
              <button
                onClick={handleCopy}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors duration-200',
                  copied
                    ? 'text-green-500 dark:text-green-400'
                    : 'text-rose/50 hover:text-rose dark:text-stone-500 dark:hover:text-rose hover:bg-rose/10'
                )}
                title={copied ? 'Copied!' : 'Copy @key: value'}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <div className="h-px flex-1 bg-gradient-to-l from-rose/30 to-transparent" />
            </div>

            {/* Full value display */}
            <div className={cn(
              'p-2 rounded-md font-mono text-sm',
              'dark:bg-stone-800/50 dark:text-stone-200',
              'bg-rose/5 text-foreground',
              'whitespace-pre-wrap break-words'
            )}>
              {displayValue}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default SetsDrawer
