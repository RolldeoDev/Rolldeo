/**
 * CommandPalette Component
 *
 * Global search modal accessible via Cmd+K / Ctrl+K.
 * Provides fuzzy search across all tables/templates and allows direct rolling.
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, X, Dices, ChevronRight, FileText, LayoutTemplate } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useRollStore } from '@/stores/rollStore'
import { useGlobalSearch, type SearchResult } from '@/hooks/useGlobalSearch'
import { useKeyboardShortcuts, formatShortcut } from '@/hooks/useKeyboardShortcuts'
import { getResultTypeIcon } from '@/lib/resultTypeIcons'

export const CommandPalette = memo(function CommandPalette() {
  const isOpen = useUIStore((state) => state.isCommandPaletteOpen)
  const closeCommandPalette = useUIStore((state) => state.closeCommandPalette)
  const toggleCommandPalette = useUIStore((state) => state.toggleCommandPalette)

  const rollOnTable = useRollStore((state) => state.rollOnTable)
  const rollOnTemplate = useRollStore((state) => state.rollOnTemplate)

  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isRolling, setIsRolling] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Search results
  const results = useGlobalSearch(query, { limit: 20 })

  // Register global keyboard shortcut
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'KeyK',
        ctrlOrCmd: true,
        handler: () => toggleCommandPalette(),
        description: 'Open command palette',
      },
    ],
    enabled: true,
  })

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      // Focus input after render
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(Math.max(0, results.length - 1))
    }
  }, [results.length, selectedIndex])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current || results.length === 0) return
    const selectedElement = listRef.current.children[selectedIndex] as HTMLElement | undefined
    selectedElement?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, results.length])

  // Handle rolling the selected item
  const handleRoll = useCallback(async (result: SearchResult) => {
    setIsRolling(true)
    try {
      if (result.item.type === 'table') {
        await rollOnTable(result.collectionId, result.item.id)
      } else {
        await rollOnTemplate(result.collectionId, result.item.id)
      }
      // Navigate to roller page with the item
      navigate(`/roll/${result.collectionId}/${result.item.id}`)
      closeCommandPalette()
    } catch (error) {
      console.error('Roll failed:', error)
    } finally {
      setIsRolling(false)
    }
  }, [rollOnTable, rollOnTemplate, navigate, closeCommandPalette])

  // Handle selecting (navigating to) the selected item without rolling
  const handleSelect = useCallback((result: SearchResult) => {
    // Navigate to roller page - RollerPage will handle selection from URL params
    navigate(`/roll/${result.collectionId}/${result.item.id}`)
    closeCommandPalette()
  }, [navigate, closeCommandPalette])

  // Keyboard navigation within the palette
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          if (e.shiftKey) {
            handleSelect(results[selectedIndex])
          } else {
            handleRoll(results[selectedIndex])
          }
        }
        break
      case 'Escape':
        e.preventDefault()
        closeCommandPalette()
        break
    }
  }, [results, selectedIndex, handleRoll, handleSelect, closeCommandPalette])

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeCommandPalette()
    }
  }, [closeCommandPalette])

  if (!isOpen) return null

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] md:pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl mx-4 bg-card border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none text-base"
            placeholder="Search tables and templates..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-muted-foreground bg-muted rounded">
            esc
          </kbd>
          <button
            onClick={closeCommandPalette}
            className="md:hidden p-1 hover:bg-accent rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-auto"
          role="listbox"
        >
          {query.length < 2 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <p className="text-sm">Type to search tables and templates</p>
              <p className="text-xs mt-2 opacity-60">
                Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to roll,{' '}
                <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Shift+Enter</kbd> to select
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-1 opacity-60">Try a different search term</p>
            </div>
          ) : (
            results.map((result, index) => (
              <CommandPaletteItem
                key={`${result.collectionId}:${result.item.id}`}
                result={result}
                isSelected={index === selectedIndex}
                isRolling={isRolling && index === selectedIndex}
                onSelect={() => handleSelect(result)}
                onRoll={() => handleRoll(result)}
                onHover={() => setSelectedIndex(index)}
              />
            ))
          )}
        </div>

        {/* Footer hints */}
        {results.length > 0 && (
          <div className="flex items-center justify-between gap-4 px-4 py-2 border-t text-xs text-muted-foreground bg-muted/30">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd>
                roll
              </span>
              <span className="hidden md:flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded">⇧↵</kbd>
                select
              </span>
            </div>
            <span className="hidden md:inline">
              {formatShortcut({ key: 'KeyK', ctrlOrCmd: true })} to toggle
            </span>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
})

// Individual search result item
interface CommandPaletteItemProps {
  result: SearchResult
  isSelected: boolean
  isRolling: boolean
  onSelect: () => void
  onRoll: () => void
  onHover: () => void
}

const CommandPaletteItem = memo(function CommandPaletteItem({
  result,
  isSelected,
  isRolling,
  onSelect,
  onRoll,
  onHover,
}: CommandPaletteItemProps) {
  const { item, collectionName, namespace } = result
  const ResultIcon = getResultTypeIcon(item.resultType)
  const TypeIcon = item.type === 'template' ? LayoutTemplate : FileText

  return (
    <div
      className={`
        group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
        ${isSelected ? 'bg-primary/10' : 'hover:bg-accent/50'}
      `}
      onClick={onRoll}
      onMouseEnter={onHover}
      role="option"
      aria-selected={isSelected}
    >
      {/* Result type icon */}
      <div className={`
        p-1.5 rounded-md flex-shrink-0
        ${item.type === 'template' ? 'bg-lavender/20' : 'bg-mint/20'}
      `}>
        <ResultIcon className={`w-4 h-4 ${item.type === 'template' ? 'text-lavender' : 'text-mint'}`} />
      </div>

      {/* Name and breadcrumb */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.name}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
          <TypeIcon className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{namespace}</span>
          <ChevronRight className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{collectionName}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className={`flex items-center gap-1 flex-shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
        <button
          className="p-1.5 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onRoll()
          }}
          disabled={isRolling}
          aria-label={`Roll ${item.name}`}
          title="Roll (Enter)"
        >
          <Dices className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
        </button>
        <button
          className="p-1.5 rounded-md bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          aria-label={`Go to ${item.name}`}
          title="Select (Shift+Enter)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
})

export default CommandPalette
