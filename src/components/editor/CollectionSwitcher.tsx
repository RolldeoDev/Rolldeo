/**
 * CollectionSwitcher Component
 *
 * An elegant dropdown for switching between collections in the editor.
 * Features search, grouping by source, and visual indicators for dirty state.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  Search,
  FileText,
  Package,
  Plus,
  Check,
  Folder,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCollectionStore, type CollectionMeta } from '@/stores/collectionStore'

interface CollectionSwitcherProps {
  /** Currently active collection ID */
  currentCollectionId?: string
  /** Whether current collection has unsaved changes */
  isDirty?: boolean
  /** Callback when attempting to switch with unsaved changes */
  onSwitchAttempt?: (targetId: string | null) => boolean
}

export function CollectionSwitcher({
  currentCollectionId,
  isDirty = false,
  onSwitchAttempt,
}: CollectionSwitcherProps) {
  const navigate = useNavigate()
  const { collections, getAllCollections } = useCollectionStore()

  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Get current collection info
  const currentCollection = currentCollectionId
    ? collections.get(currentCollectionId)
    : null

  // Organize collections into groups
  const { preloaded, userCreated, imported } = useMemo(() => {
    const all = getAllCollections()
    return {
      preloaded: all.filter((c) => c.source === 'preloaded'),
      userCreated: all.filter((c) => c.source === 'user'),
      imported: all.filter((c) => c.source === 'file' || c.source === 'zip'),
    }
  }, [getAllCollections, collections])

  // Filter collections based on search
  const filteredGroups = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    const filterFn = (c: CollectionMeta) =>
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.namespace.toLowerCase().includes(query) ||
      c.tags.some((t) => t.toLowerCase().includes(query))

    return {
      preloaded: preloaded.filter(filterFn),
      userCreated: userCreated.filter(filterFn),
      imported: imported.filter(filterFn),
    }
  }, [preloaded, userCreated, imported, searchQuery])

  // Flatten for keyboard navigation
  const flattenedItems = useMemo(() => {
    const items: Array<{ type: 'collection' | 'new'; data?: CollectionMeta }> = []

    // "New Collection" option always first
    items.push({ type: 'new' })

    // Add collections in group order
    filteredGroups.userCreated.forEach((c) => items.push({ type: 'collection', data: c }))
    filteredGroups.imported.forEach((c) => items.push({ type: 'collection', data: c }))
    filteredGroups.preloaded.forEach((c) => items.push({ type: 'collection', data: c }))

    return items
  }, [filteredGroups])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
        setFocusedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-item]')
      items[focusedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIndex])

  const handleSelect = useCallback(
    (collectionId: string | null) => {
      // Check if we should block navigation due to unsaved changes
      if (onSwitchAttempt && !onSwitchAttempt(collectionId)) {
        return
      }

      setIsOpen(false)
      setSearchQuery('')
      setFocusedIndex(-1)

      if (collectionId === null) {
        navigate('/editor')
      } else if (collectionId !== currentCollectionId) {
        navigate(`/editor/${collectionId}`)
      }
    },
    [navigate, currentCollectionId, onSwitchAttempt]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault()
          setIsOpen(true)
        }
        return
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          setSearchQuery('')
          setFocusedIndex(-1)
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((i) => Math.min(i + 1, flattenedItems.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < flattenedItems.length) {
            const item = flattenedItems[focusedIndex]
            handleSelect(item.type === 'new' ? null : item.data!.id)
          }
          break
      }
    },
    [isOpen, focusedIndex, flattenedItems, handleSelect]
  )

  const totalCollections = preloaded.length + userCreated.length + imported.length

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          'group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200',
          'border border-border/50 hover:border-border hover:bg-accent/50',
          'focus:outline-none focus:ring-2 focus:ring-primary/30',
          isOpen && 'border-primary/50 bg-accent/50 ring-2 ring-primary/20'
        )}
      >
        {/* Collection Icon */}
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
            currentCollection
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {currentCollection ? (
            currentCollection.source === 'preloaded' ? (
              <BookOpen className="w-4 h-4" />
            ) : (
              <FileText className="w-4 h-4" />
            )
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </div>

        {/* Collection Info */}
        <div className="flex flex-col items-start min-w-0">
          <span className="text-sm font-semibold truncate max-w-[200px]">
            {currentCollection?.name || 'New Collection'}
          </span>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {currentCollection?.namespace || 'Untitled'}
            {isDirty && (
              <span className="ml-1.5 text-amber-500 dark:text-amber-400">• unsaved</span>
            )}
          </span>
        </div>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 mt-2 w-80 z-50',
            'bg-popover border border-border rounded-2xl shadow-xl',
            'animate-slide-up overflow-hidden'
          )}
          style={{
            boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Search Header */}
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setFocusedIndex(0)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search collections..."
                className={cn(
                  'w-full pl-9 pr-4 py-2 text-sm rounded-lg',
                  'bg-muted/50 border border-transparent',
                  'placeholder:text-muted-foreground',
                  'focus:outline-none focus:border-primary/30 focus:bg-background'
                )}
              />
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-xs text-muted-foreground">
                {totalCollections} collection{totalCollections !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted-foreground">
                ↑↓ navigate • ↵ select
              </span>
            </div>
          </div>

          {/* Collection List */}
          <div
            ref={listRef}
            className="max-h-80 overflow-y-auto py-2"
            onKeyDown={handleKeyDown}
          >
            {/* New Collection Option */}
            <div className="px-2 mb-1">
              <button
                type="button"
                data-item
                onClick={() => handleSelect(null)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                  'hover:bg-primary/10',
                  focusedIndex === 0 && 'bg-primary/10',
                  !currentCollectionId && 'bg-primary/5 ring-1 ring-primary/20'
                )}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">New Collection</span>
                  <span className="text-xs text-muted-foreground">Create from scratch</span>
                </div>
              </button>
            </div>

            {/* User Created Collections */}
            {filteredGroups.userCreated.length > 0 && (
              <CollectionGroup
                label="Your Collections"
                icon={<FileText className="w-3.5 h-3.5" />}
                collections={filteredGroups.userCreated}
                currentId={currentCollectionId}
                focusedIndex={focusedIndex}
                startIndex={1}
                onSelect={handleSelect}
              />
            )}

            {/* Imported Collections */}
            {filteredGroups.imported.length > 0 && (
              <CollectionGroup
                label="Imported"
                icon={<Folder className="w-3.5 h-3.5" />}
                collections={filteredGroups.imported}
                currentId={currentCollectionId}
                focusedIndex={focusedIndex}
                startIndex={1 + filteredGroups.userCreated.length}
                onSelect={handleSelect}
              />
            )}

            {/* Preloaded Collections */}
            {filteredGroups.preloaded.length > 0 && (
              <CollectionGroup
                label="Built-in Examples"
                icon={<Package className="w-3.5 h-3.5" />}
                collections={filteredGroups.preloaded}
                currentId={currentCollectionId}
                focusedIndex={focusedIndex}
                startIndex={1 + filteredGroups.userCreated.length + filteredGroups.imported.length}
                onSelect={handleSelect}
              />
            )}

            {/* Empty State */}
            {flattenedItems.length === 1 && searchQuery && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No collections match "{searchQuery}"
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface CollectionGroupProps {
  label: string
  icon: React.ReactNode
  collections: CollectionMeta[]
  currentId?: string
  focusedIndex: number
  startIndex: number
  onSelect: (id: string) => void
}

function CollectionGroup({
  label,
  icon,
  collections,
  currentId,
  focusedIndex,
  startIndex,
  onSelect,
}: CollectionGroupProps) {
  return (
    <div className="mb-1">
      {/* Group Header */}
      <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
        <span className="text-muted-foreground/60">({collections.length})</span>
      </div>

      {/* Group Items */}
      <div className="px-2 space-y-0.5">
        {collections.map((collection, index) => {
          const itemIndex = startIndex + index
          const isActive = collection.id === currentId
          const isFocused = focusedIndex === itemIndex

          return (
            <button
              key={collection.id}
              type="button"
              data-item
              onClick={() => onSelect(collection.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150',
                'hover:bg-accent/80',
                isFocused && 'bg-accent/80',
                isActive && 'bg-primary/5 ring-1 ring-primary/20'
              )}
            >
              {/* Collection Icon */}
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted/80 text-muted-foreground'
                )}
              >
                {collection.source === 'preloaded' ? (
                  <BookOpen className="w-4 h-4" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
              </div>

              {/* Collection Info */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-medium truncate',
                      isActive && 'text-primary'
                    )}
                  >
                    {collection.name}
                  </span>
                  {isActive && (
                    <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{collection.namespace}</span>
                  <span className="flex-shrink-0">
                    • {collection.tableCount} table{collection.tableCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default CollectionSwitcher
