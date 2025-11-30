/**
 * CollectionPathSelector Component
 *
 * A combobox-style selector for import paths that shows available collections
 * while allowing free text entry for external URLs.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Search, Library, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CollectionMeta } from '@/stores/collectionStore'

interface CollectionPathSelectorProps {
  value: string
  onChange: (path: string) => void
  availableCollections: CollectionMeta[]
  placeholder?: string
  hasError?: boolean
}

interface CollectionItem {
  id: string
  name: string
  namespace: string
  isPreloaded: boolean
  tableCount: number
}

export function CollectionPathSelector({
  value,
  onChange,
  availableCollections,
  placeholder = 'Select collection or enter URL...',
  hasError = false,
}: CollectionPathSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  // Transform collections into items
  const items = useMemo((): CollectionItem[] => {
    return availableCollections.map((c) => ({
      id: c.id,
      name: c.name,
      namespace: c.namespace,
      isPreloaded: c.isPreloaded,
      tableCount: c.tableCount,
    }))
  }, [availableCollections])

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items
    const query = search.toLowerCase()
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.namespace.toLowerCase().includes(query)
    )
  }, [items, search])

  // Group filtered items
  const groupedItems = useMemo(() => {
    const preloaded: CollectionItem[] = []
    const user: CollectionItem[] = []
    filteredItems.forEach((item) => {
      if (item.isPreloaded) {
        preloaded.push(item)
      } else {
        user.push(item)
      }
    })
    return { preloaded, user }
  }, [filteredItems])

  // Check if current value matches a collection
  const selectedCollection = useMemo(() => {
    return items.find((item) => item.namespace === value)
  }, [items, value])

  // Update position when opening
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [isOpen])

  // Reset highlighted index when filtering
  useEffect(() => {
    setHighlightedIndex(0)
  }, [search])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setSearch('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (!isOpen) {
            setIsOpen(true)
          } else {
            setHighlightedIndex((i) => Math.min(i + 1, filteredItems.length - 1))
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (isOpen && filteredItems[highlightedIndex]) {
            handleSelect(filteredItems[highlightedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          setSearch('')
          break
        case 'Tab':
          setIsOpen(false)
          setSearch('')
          break
      }
    },
    [isOpen, filteredItems, highlightedIndex]
  )

  const handleSelect = useCallback(
    (item: CollectionItem) => {
      onChange(item.namespace)
      setIsOpen(false)
      setSearch('')
    },
    [onChange]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearch(newValue)
    onChange(newValue)
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleFocus = () => {
    setIsOpen(true)
    setSearch(value)
  }

  const renderGroup = (title: string, groupItems: CollectionItem[], startIndex: number) => {
    if (groupItems.length === 0) return null

    return (
      <div key={title}>
        <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/30">
          {title}
        </div>
        {groupItems.map((item, i) => {
          const globalIndex = startIndex + i
          const isSelected = item.namespace === value

          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
                globalIndex === highlightedIndex
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-accent/50'
              )}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setHighlightedIndex(globalIndex)}
            >
              <Library className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.name}</div>
                <div className="text-xs text-muted-foreground truncate font-mono">
                  {item.namespace}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground/60">
                  {item.tableCount} tables
                </span>
                {isSelected && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  // Calculate start indices for each group
  const preloadedStartIndex = 0
  const userStartIndex = groupedItems.preloaded.length

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full px-3 py-2 pr-8 text-sm rounded-lg border bg-background transition-colors font-mono text-xs',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            hasError
              ? 'border-destructive/50 focus:border-destructive'
              : 'border-border/50 focus:border-primary'
          )}
        />
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen)
            if (!isOpen) {
              setSearch(value)
              inputRef.current?.focus()
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-accent rounded transition-colors"
        >
          <ChevronDown className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )} />
        </button>
        {selectedCollection && !isOpen && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            <Check className="h-4 w-4 text-green-500" />
          </div>
        )}
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 bg-popover border border-border/50 rounded-xl shadow-xl overflow-hidden animate-fade-in"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              minWidth: 280,
            }}
          >
            {/* Search hint */}
            <div className="px-3 py-2 border-b border-border/30 bg-muted/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Search className="h-3 w-3" />
                <span>Type to search or enter a URL</span>
              </div>
            </div>

            {/* Items */}
            <div className="max-h-64 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {search.trim() ? 'No matching collections' : 'No collections available'}
                </div>
              ) : (
                <>
                  {renderGroup('Preloaded', groupedItems.preloaded, preloadedStartIndex)}
                  {renderGroup('Your Collections', groupedItems.user, userStartIndex)}
                </>
              )}
            </div>

            {/* Keyboard Hint */}
            <div className="px-3 py-2 border-t border-border/30 bg-muted/30">
              <p className="text-xs text-muted-foreground/70">
                <kbd className="px-1 py-0.5 bg-background rounded text-[10px]">↑↓</kbd> navigate
                <span className="mx-2">·</span>
                <kbd className="px-1 py-0.5 bg-background rounded text-[10px]">Enter</kbd> select
                <span className="mx-2">·</span>
                <kbd className="px-1 py-0.5 bg-background rounded text-[10px]">Esc</kbd> close
              </p>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default CollectionPathSelector
