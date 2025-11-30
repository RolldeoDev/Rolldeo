/**
 * InsertDropdown Component
 *
 * Inline searchable dropdown for inserting table/template references into patterns.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, Table2, Sparkles, Dices, Calculator, Variable, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InsertDropdownProps {
  availableTableIds: string[]
  availableTemplateIds: string[]
  onInsert: (text: string) => void
  buttonClassName?: string
}

interface InsertItem {
  id: string
  label: string
  insertText: string
  group: 'tables' | 'templates' | 'syntax'
  icon: typeof Table2
  description?: string
}

const SYNTAX_ITEMS: InsertItem[] = [
  {
    id: 'dice',
    label: 'Dice Roll',
    insertText: '{{dice:2d6}}',
    group: 'syntax',
    icon: Dices,
    description: 'Roll dice (e.g., 2d6, 1d20+5)',
  },
  {
    id: 'math',
    label: 'Math Expression',
    insertText: '{{math:1 + 2}}',
    group: 'syntax',
    icon: Calculator,
    description: 'Calculate math expressions',
  },
  {
    id: 'variable',
    label: 'Variable Reference',
    insertText: '{{$variableName}}',
    group: 'syntax',
    icon: Variable,
    description: 'Reference a shared variable',
  },
  {
    id: 'again',
    label: 'Re-roll (Again)',
    insertText: '{{again}}',
    group: 'syntax',
    icon: RotateCcw,
    description: 'Re-roll the previous value',
  },
]

export function InsertDropdown({
  availableTableIds,
  availableTemplateIds,
  onInsert,
  buttonClassName,
}: InsertDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  // Build list of all insertable items
  const allItems = useMemo((): InsertItem[] => {
    const tableItems: InsertItem[] = availableTableIds.map((id) => ({
      id: `table-${id}`,
      label: id,
      insertText: `{{${id}}}`,
      group: 'tables' as const,
      icon: Table2,
    }))

    const templateItems: InsertItem[] = availableTemplateIds.map((id) => ({
      id: `template-${id}`,
      label: id,
      insertText: `{{${id}}}`,
      group: 'templates' as const,
      icon: Sparkles,
    }))

    return [...tableItems, ...templateItems, ...SYNTAX_ITEMS]
  }, [availableTableIds, availableTemplateIds])

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return allItems
    const query = search.toLowerCase()
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
    )
  }, [allItems, search])

  // Group filtered items
  const groupedItems = useMemo(() => {
    const groups: Record<string, InsertItem[]> = {
      tables: [],
      templates: [],
      syntax: [],
    }
    filteredItems.forEach((item) => {
      groups[item.group].push(item)
    })
    return groups
  }, [filteredItems])

  // Update position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      })
      // Focus search input
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
  }, [isOpen])

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setHighlightedIndex(0)
    }
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
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
          setHighlightedIndex((i) => Math.min(i + 1, filteredItems.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredItems[highlightedIndex]) {
            onInsert(filteredItems[highlightedIndex].insertText)
            setIsOpen(false)
          }
          break
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          break
      }
    },
    [filteredItems, highlightedIndex, onInsert]
  )

  const handleItemClick = useCallback(
    (item: InsertItem) => {
      onInsert(item.insertText)
      setIsOpen(false)
    },
    [onInsert]
  )

  const renderGroup = (title: string, items: InsertItem[], startIndex: number) => {
    if (items.length === 0) return null

    return (
      <div key={title}>
        <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/30">
          {title}
        </div>
        {items.map((item, i) => {
          const Icon = item.icon
          const globalIndex = startIndex + i

          return (
            <button
              key={item.id}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
                globalIndex === highlightedIndex
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-accent/50'
              )}
              onClick={() => handleItemClick(item)}
              onMouseEnter={() => setHighlightedIndex(globalIndex)}
            >
              <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.label}</div>
                {item.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                )}
              </div>
              <code className="text-xs text-muted-foreground/60 font-mono truncate max-w-[100px]">
                {item.insertText}
              </code>
            </button>
          )
        })}
      </div>
    )
  }

  // Calculate start indices for each group
  let startIndex = 0
  const tablesStartIndex = startIndex
  startIndex += groupedItems.tables.length
  const templatesStartIndex = startIndex
  startIndex += groupedItems.templates.length
  const syntaxStartIndex = startIndex

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors',
          'hover:bg-accent hover:border-border',
          isOpen && 'bg-accent border-border',
          buttonClassName
        )}
        title="Insert table or syntax reference"
      >
        <Plus className="h-3.5 w-3.5" />
        Insert
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 w-72 bg-popover border border-border/50 rounded-xl shadow-xl overflow-hidden animate-fade-in"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
            onKeyDown={handleKeyDown}
          >
            {/* Search Input */}
            <div className="p-2 border-b border-border/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setHighlightedIndex(0)
                  }}
                  placeholder="Search tables, templates..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* Items */}
            <div className="max-h-64 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No matches found
                </div>
              ) : (
                <>
                  {renderGroup('Tables', groupedItems.tables, tablesStartIndex)}
                  {renderGroup('Templates', groupedItems.templates, templatesStartIndex)}
                  {renderGroup('Syntax', groupedItems.syntax, syntaxStartIndex)}
                </>
              )}
            </div>

            {/* Keyboard Hint */}
            <div className="px-3 py-2 border-t border-border/30 bg-muted/30">
              <p className="text-xs text-muted-foreground/70">
                <kbd className="px-1 py-0.5 bg-background rounded text-[10px]">↑↓</kbd> navigate
                <span className="mx-2">·</span>
                <kbd className="px-1 py-0.5 bg-background rounded text-[10px]">Enter</kbd> insert
                <span className="mx-2">·</span>
                <kbd className="px-1 py-0.5 bg-background rounded text-[10px]">Esc</kbd> close
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

export default InsertDropdown
