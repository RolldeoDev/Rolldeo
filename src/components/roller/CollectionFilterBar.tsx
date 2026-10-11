/**
 * CollectionFilterBar Component
 *
 * Compact filter bar for the Roller page to filter collections by search and namespace.
 * Positioned above the CollectionAccordion.
 */

import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, ChevronDown, FolderTree, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { formatNamespace } from '@/lib/namespaceUtils'

interface CollectionFilterBarProps {
  /** All unique namespaces available */
  allNamespaces: string[]
  /** Total collection count */
  totalCount: number
  /** Filtered collection count */
  filteredCount: number
}

export const CollectionFilterBar = memo(function CollectionFilterBar({
  allNamespaces,
  totalCount,
  filteredCount,
}: CollectionFilterBarProps) {
  const {
    rollerCollectionSearchQuery,
    setRollerCollectionSearchQuery,
    rollerNamespaceFilter,
    setRollerNamespaceFilter,
    clearRollerCollectionFilters,
  } = useUIStore()

  const [namespaceDropdownOpen, setNamespaceDropdownOpen] = useState(false)
  const [namespaceSearch, setNamespaceSearch] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Calculate dropdown position when opening
  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      })
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setNamespaceDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter namespaces by search
  const filteredNamespaces = namespaceSearch
    ? allNamespaces.filter((ns) =>
        formatNamespace(ns).toLowerCase().includes(namespaceSearch.toLowerCase())
      )
    : allNamespaces

  const handleNamespaceSelect = useCallback((namespace: string | null) => {
    setRollerNamespaceFilter(namespace)
    setNamespaceDropdownOpen(false)
    setNamespaceSearch('')
  }, [setRollerNamespaceFilter])

  const hasActiveFilters = rollerCollectionSearchQuery || rollerNamespaceFilter

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border/50 bg-card/50">
      {/* Search input */}
      <div className="relative flex-1 min-w-[140px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search..."
          value={rollerCollectionSearchQuery}
          onChange={(e) => setRollerCollectionSearchQuery(e.target.value)}
          className="w-full h-8 pl-8 pr-7 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {rollerCollectionSearchQuery && (
          <button
            onClick={() => setRollerCollectionSearchQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Namespace dropdown */}
      <div>
        <button
          ref={buttonRef}
          onClick={() => {
            if (!namespaceDropdownOpen) {
              updateDropdownPosition()
            }
            setNamespaceDropdownOpen(!namespaceDropdownOpen)
          }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 h-8 rounded-lg border text-sm transition-all',
            rollerNamespaceFilter
              ? 'bg-copper/15 border-copper/40 text-copper'
              : 'bg-background border-border hover:border-border/80 text-muted-foreground hover:text-foreground'
          )}
        >
          <FolderTree className="h-3.5 w-3.5" />
          <span className="max-w-[100px] truncate">
            {rollerNamespaceFilter
              ? formatNamespace(rollerNamespaceFilter)
              : 'All'}
          </span>
          <ChevronDown className={cn(
            'h-3.5 w-3.5 transition-transform',
            namespaceDropdownOpen && 'rotate-180'
          )} />
        </button>

        {/* Dropdown menu - rendered via portal */}
        {namespaceDropdownOpen && createPortal(
          <div
            ref={dropdownRef}
            className="fixed w-64 max-h-72 overflow-hidden rounded-lg border border-border bg-popover shadow-xl z-[100] animate-fade-in"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
          >
            {/* Search within dropdown */}
            <div className="p-2 border-b border-border/50">
              <input
                type="text"
                placeholder="Search namespaces..."
                value={namespaceSearch}
                onChange={(e) => setNamespaceSearch(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
            </div>

            {/* Options */}
            <div className="overflow-y-auto max-h-48 p-1">
              {/* All namespaces option */}
              <button
                onClick={() => handleNamespaceSelect(null)}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-sm transition-colors',
                  !rollerNamespaceFilter
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-white/5 text-foreground'
                )}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {!rollerNamespaceFilter && <Check className="h-3.5 w-3.5" />}
                </div>
                <span className="font-medium">All Namespaces</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {totalCount}
                </span>
              </button>

              {/* Namespace list */}
              {filteredNamespaces.map((namespace) => (
                <button
                  key={namespace}
                  onClick={() => handleNamespaceSelect(namespace)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-sm transition-colors',
                    rollerNamespaceFilter === namespace
                      ? 'bg-copper/15 text-copper'
                      : 'hover:bg-white/5 text-foreground'
                  )}
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    {rollerNamespaceFilter === namespace && (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span className="truncate">{formatNamespace(namespace)}</span>
                </button>
              ))}

              {filteredNamespaces.length === 0 && (
                <div className="px-2.5 py-3 text-center text-xs text-muted-foreground">
                  No namespaces match "{namespaceSearch}"
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* Clear button */}
      {hasActiveFilters && (
        <button
          onClick={clearRollerCollectionFilters}
          className="flex items-center gap-1 px-2 h-8 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-white/5 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}

      {/* Filter count */}
      {hasActiveFilters && (
        <span className="text-xs text-muted-foreground">
          {filteredCount}/{totalCount}
        </span>
      )}
    </div>
  )
})

export default CollectionFilterBar
