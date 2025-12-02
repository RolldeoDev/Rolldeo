/**
 * LibraryFilterBar Component
 *
 * Comprehensive filter bar for the Library page with search, namespace dropdown,
 * tag pills, view mode toggle, and group depth selector.
 */

import { memo, useState, useRef, useEffect, useCallback } from 'react'
import {
  Search,
  X,
  ChevronDown,
  Grid3X3,
  Layers,
  Check,
  FolderTree,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { formatNamespace } from '@/lib/namespaceUtils'

interface LibraryFilterBarProps {
  /** All unique namespaces available */
  allNamespaces: string[]
  /** All available tags */
  allTags: string[]
  /** Total collection count (for display) */
  totalCount: number
  /** Filtered collection count */
  filteredCount: number
}

export const LibraryFilterBar = memo(function LibraryFilterBar({
  allNamespaces,
  allTags,
  totalCount,
  filteredCount,
}: LibraryFilterBarProps) {
  const {
    searchQuery,
    setSearchQuery,
    selectedTags,
    toggleTag,
    libraryViewMode,
    setLibraryViewMode,
    libraryGroupDepth,
    setLibraryGroupDepth,
    libraryNamespaceFilter,
    setLibraryNamespaceFilter,
    clearLibraryFilters,
  } = useUIStore()

  const [namespaceDropdownOpen, setNamespaceDropdownOpen] = useState(false)
  const [namespaceSearch, setNamespaceSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
    setLibraryNamespaceFilter(namespace)
    setNamespaceDropdownOpen(false)
    setNamespaceSearch('')
  }, [setLibraryNamespaceFilter])

  const hasActiveFilters = searchQuery || selectedTags.length > 0 || libraryNamespaceFilter

  return (
    <div className="space-y-4">
      {/* Main filter row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-dark pl-10 pr-8 w-full h-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Namespace dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setNamespaceDropdownOpen(!namespaceDropdownOpen)}
            className={cn(
              'flex items-center gap-2 px-3 h-10 rounded-lg border transition-all',
              libraryNamespaceFilter
                ? 'bg-copper/15 border-copper/40 text-copper'
                : 'bg-card border-border hover:border-border/80 text-muted-foreground hover:text-foreground'
            )}
          >
            <FolderTree className="h-4 w-4" />
            <span className="text-sm max-w-[150px] truncate">
              {libraryNamespaceFilter
                ? formatNamespace(libraryNamespaceFilter)
                : 'All Namespaces'}
            </span>
            <ChevronDown className={cn(
              'h-4 w-4 transition-transform',
              namespaceDropdownOpen && 'rotate-180'
            )} />
          </button>

          {/* Dropdown menu */}
          {namespaceDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 max-h-80 overflow-hidden rounded-xl border border-border bg-popover shadow-xl z-50 animate-fade-in">
              {/* Search within dropdown */}
              <div className="p-2 border-b border-border/50">
                <input
                  type="text"
                  placeholder="Search namespaces..."
                  value={namespaceSearch}
                  onChange={(e) => setNamespaceSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
              </div>

              {/* Options */}
              <div className="overflow-y-auto max-h-56 p-1">
                {/* All namespaces option */}
                <button
                  onClick={() => handleNamespaceSelect(null)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                    !libraryNamespaceFilter
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-white/5 text-foreground'
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    {!libraryNamespaceFilter && <Check className="h-4 w-4" />}
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
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                      libraryNamespaceFilter === namespace
                        ? 'bg-copper/15 text-copper'
                        : 'hover:bg-white/5 text-foreground'
                    )}
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      {libraryNamespaceFilter === namespace && (
                        <Check className="h-4 w-4" />
                      )}
                    </div>
                    <span className="truncate">{formatNamespace(namespace)}</span>
                  </button>
                ))}

                {filteredNamespaces.length === 0 && (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    No namespaces match "{namespaceSearch}"
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => setLibraryViewMode('grid')}
            className={cn(
              'flex items-center gap-1.5 px-3 h-10 text-sm transition-colors',
              libraryViewMode === 'grid'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            )}
            title="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <div className="w-px h-6 bg-border" />
          <button
            onClick={() => setLibraryViewMode('grouped')}
            className={cn(
              'flex items-center gap-1.5 px-3 h-10 text-sm transition-colors',
              libraryViewMode === 'grouped'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            )}
            title="Grouped by namespace"
          >
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Grouped</span>
          </button>
        </div>

        {/* Group depth toggle (only when grouped view) */}
        {libraryViewMode === 'grouped' && (
          <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => setLibraryGroupDepth(1)}
              className={cn(
                'px-3 h-10 text-sm transition-colors',
                libraryGroupDepth === 1
                  ? 'bg-copper/15 text-copper'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
              title="Group by publisher only"
            >
              Publisher
            </button>
            <div className="w-px h-6 bg-border" />
            <button
              onClick={() => setLibraryGroupDepth(2)}
              className={cn(
                'px-3 h-10 text-sm transition-colors',
                libraryGroupDepth === 2
                  ? 'bg-copper/15 text-copper'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
              title="Group by publisher and product"
            >
              Product
            </button>
          </div>
        )}

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            onClick={clearLibraryFilters}
            className="flex items-center gap-1.5 px-3 h-10 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}

        {/* Filter count */}
        {hasActiveFilters && (
          <span className="text-sm text-muted-foreground">
            {filteredCount} of {totalCount}
          </span>
        )}
      </div>

      {/* Tag pills row */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Tags:</span>
          {allTags.slice(0, 12).map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                'pill transition-all duration-200',
                selectedTags.includes(tag)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'pill-outline hover:border-white/30'
              )}
            >
              {tag}
            </button>
          ))}
          {allTags.length > 12 && (
            <span className="text-xs text-muted-foreground">
              +{allTags.length - 12} more
            </span>
          )}
        </div>
      )}
    </div>
  )
})

export default LibraryFilterBar
