/**
 * InsertDropdown Component
 *
 * Inline searchable dropdown for inserting table/template references into patterns.
 * Supports local tables/templates and imported items with tabbed navigation.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, Table2, Sparkles, Dices, Calculator, Variable, RotateCcw, CircleDot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getResultTypeIcon } from '@/lib/resultTypeIcons'
import type { TableInfo, TemplateInfo, ImportedTableInfo, ImportedTemplateInfo } from '@/engine/core'

interface InsertDropdownProps {
  localTables: TableInfo[]
  localTemplates: TemplateInfo[]
  importedTables?: ImportedTableInfo[]
  importedTemplates?: ImportedTemplateInfo[]
  onInsert: (text: string) => void
  buttonClassName?: string
  /** Called when dropdown opens or closes */
  onOpenChange?: (isOpen: boolean) => void
}

interface InsertItem {
  id: string
  label: string
  insertText: string
  type: 'table' | 'template' | 'syntax'
  source: string // Collection name (e.g., "Local", "Fantasy Names")
  icon: typeof Table2
  description?: string
  colorClass: 'mint' | 'lavender' | 'amber'
}

type TabType = 'tables' | 'templates' | 'syntax'

const SYNTAX_SOURCE = 'Syntax Helpers'
const LOCAL_SOURCE = 'Local'

const SYNTAX_ITEMS: InsertItem[] = [
  {
    id: 'dice',
    label: 'Dice Roll',
    insertText: '{{dice:2d6}}',
    type: 'syntax',
    source: SYNTAX_SOURCE,
    icon: Dices,
    description: 'Roll dice (e.g., 2d6, 1d20+5)',
    colorClass: 'amber',
  },
  {
    id: 'math',
    label: 'Math Expression',
    insertText: '{{math:1 + 2}}',
    type: 'syntax',
    source: SYNTAX_SOURCE,
    icon: Calculator,
    description: 'Calculate math expressions',
    colorClass: 'amber',
  },
  {
    id: 'variable',
    label: 'Variable Reference',
    insertText: '{{$variableName}}',
    type: 'syntax',
    source: SYNTAX_SOURCE,
    icon: Variable,
    description: 'Reference a shared variable',
    colorClass: 'amber',
  },
  {
    id: 'capture-shared',
    label: 'Capture Property',
    insertText: '{{$varName.@property}}',
    type: 'syntax',
    source: SYNTAX_SOURCE,
    icon: CircleDot,
    description: 'Access property from capture-aware variable',
    colorClass: 'amber',
  },
  {
    id: 'again',
    label: 'Re-roll (Again)',
    insertText: '{{again}}',
    type: 'syntax',
    source: SYNTAX_SOURCE,
    icon: RotateCcw,
    description: 'Re-roll the previous value',
    colorClass: 'amber',
  },
]

export function InsertDropdown({
  localTables,
  localTemplates,
  importedTables = [],
  importedTemplates = [],
  onInsert,
  buttonClassName,
  onOpenChange,
}: InsertDropdownProps) {
  const [isOpen, setIsOpenState] = useState(false)

  // Wrapper to notify parent of open state changes
  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenState(open)
    onOpenChange?.(open)
  }, [onOpenChange])
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('tables')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  // Build list of all insertable items
  const allItems = useMemo((): InsertItem[] => {
    // Local tables - use result type icon if available, otherwise Table2
    const tableItems: InsertItem[] = localTables.map((table) => ({
      id: `table-${table.id}`,
      label: table.id,
      insertText: `{{${table.id}}}`,
      type: 'table' as const,
      source: LOCAL_SOURCE,
      icon: table.resultType ? getResultTypeIcon(table.resultType) : Table2,
      description: table.name !== table.id ? table.name : undefined,
      colorClass: 'mint',
    }))

    // Local templates - use result type icon if available, otherwise Sparkles
    const templateItems: InsertItem[] = localTemplates.map((template) => ({
      id: `template-${template.id}`,
      label: template.id,
      insertText: `{{${template.id}}}`,
      type: 'template' as const,
      source: LOCAL_SOURCE,
      icon: template.resultType ? getResultTypeIcon(template.resultType) : Sparkles,
      description: template.name !== template.id ? template.name : undefined,
      colorClass: 'lavender',
    }))

    // Imported tables - use result type icon if available, otherwise Table2
    const importedTableItems: InsertItem[] = importedTables.map((table) => ({
      id: `imported-table-${table.alias}-${table.id}`,
      label: `${table.alias}.${table.id}`,
      insertText: `{{${table.alias}.${table.id}}}`,
      type: 'table' as const,
      source: table.sourceCollectionName,
      icon: table.resultType ? getResultTypeIcon(table.resultType) : Table2,
      description: table.name !== table.id ? table.name : undefined,
      colorClass: 'mint',
    }))

    // Imported templates - use result type icon if available, otherwise Sparkles
    const importedTemplateItems: InsertItem[] = importedTemplates.map((template) => ({
      id: `imported-template-${template.alias}-${template.id}`,
      label: `${template.alias}.${template.id}`,
      insertText: `{{${template.alias}.${template.id}}}`,
      type: 'template' as const,
      source: template.sourceCollectionName,
      icon: template.resultType ? getResultTypeIcon(template.resultType) : Sparkles,
      description: template.name !== template.id ? template.name : undefined,
      colorClass: 'lavender',
    }))

    return [...tableItems, ...templateItems, ...importedTableItems, ...importedTemplateItems, ...SYNTAX_ITEMS]
  }, [localTables, localTemplates, importedTables, importedTemplates])

  // Filter items by tab and search
  const filteredItems = useMemo(() => {
    // Map plural tab names to singular item types
    const typeMap: Record<TabType, 'table' | 'template' | 'syntax'> = {
      tables: 'table',
      templates: 'template',
      syntax: 'syntax'
    }
    let items = allItems.filter((item) => item.type === typeMap[activeTab])

    // Filter by search query
    if (search.trim()) {
      const query = search.toLowerCase()
      items = items.filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.source.toLowerCase().includes(query)
      )
    }

    return items
  }, [allItems, activeTab, search])

  // Group filtered items by source
  const groupedItems = useMemo(() => {
    const groups: Record<string, InsertItem[]> = {}

    filteredItems.forEach((item) => {
      if (!groups[item.source]) {
        groups[item.source] = []
      }
      groups[item.source].push(item)
    })

    // Sort groups: Local first, then alphabetically, Syntax Helpers last
    const sortedEntries = Object.entries(groups).sort(([a], [b]) => {
      if (a === LOCAL_SOURCE) return -1
      if (b === LOCAL_SOURCE) return 1
      if (a === SYNTAX_SOURCE) return 1
      if (b === SYNTAX_SOURCE) return -1
      return a.localeCompare(b)
    })

    return sortedEntries
  }, [filteredItems])

  // Count items per tab for badges
  const tabCounts = useMemo(() => ({
    tables: allItems.filter((item) => item.type === 'table').length,
    templates: allItems.filter((item) => item.type === 'template').length,
    syntax: allItems.filter((item) => item.type === 'syntax').length,
  }), [allItems])

  // Update position when opening - smart positioning to stay within viewport
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const dropdownWidth = 384  // w-96
      const dropdownHeight = 360 // approximate max height (tabs + search + items + hint)
      const gap = 4
      const margin = 8 // minimum margin from viewport edges

      // Horizontal: prefer left-aligned, but flip to right-aligned if needed
      let left = rect.left
      if (rect.left + dropdownWidth > window.innerWidth - margin) {
        left = rect.right - dropdownWidth
      }
      // Ensure doesn't go off left edge
      left = Math.max(margin, left)

      // Vertical: prefer below, but flip to above if needed
      let top = rect.bottom + gap
      if (rect.bottom + dropdownHeight > window.innerHeight - margin) {
        top = rect.top - dropdownHeight - gap
      }
      // Ensure doesn't go off top edge
      top = Math.max(margin, top)

      setDropdownPosition({ top, left })
      // Focus search input
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
  }, [isOpen])

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setActiveTab('tables')
      setHighlightedIndex(0)
    }
  }, [isOpen])

  // Reset highlighted index when tab or search changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [activeTab, search])

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
        case 'Tab':
          e.preventDefault()
          // Cycle through tabs
          const tabs: TabType[] = ['tables', 'templates', 'syntax']
          const currentIndex = tabs.indexOf(activeTab)
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + tabs.length) % tabs.length
            : (currentIndex + 1) % tabs.length
          setActiveTab(tabs[nextIndex])
          break
      }
    },
    [filteredItems, highlightedIndex, onInsert, activeTab]
  )

  const handleItemClick = useCallback(
    (item: InsertItem) => {
      onInsert(item.insertText)
      setIsOpen(false)
    },
    [onInsert]
  )

  // Get highlight classes based on item color
  const getHighlightClasses = (colorClass: InsertItem['colorClass'], isHighlighted: boolean) => {
    if (!isHighlighted) return 'hover:bg-accent/50'
    switch (colorClass) {
      case 'mint': return 'bg-mint/10 text-mint'
      case 'lavender': return 'bg-lavender/10 text-lavender'
      case 'amber': return 'bg-amber/10 text-amber'
      default: return 'bg-primary/10 text-primary'
    }
  }

  // Get icon color class
  const getIconColorClass = (colorClass: InsertItem['colorClass']) => {
    switch (colorClass) {
      case 'mint': return 'text-mint'
      case 'lavender': return 'text-lavender'
      case 'amber': return 'text-amber'
      default: return 'text-muted-foreground'
    }
  }

  // Render grouped items with proper highlighting
  const renderGroups = () => {
    let currentIndex = 0

    return groupedItems.map(([source, items]) => (
      <div key={source}>
        <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted sticky top-0 z-10">
          {source}
        </div>
        {items.map((item) => {
          const Icon = item.icon
          const globalIndex = currentIndex++
          const isHighlighted = globalIndex === highlightedIndex

          return (
            <button
              key={item.id}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
                getHighlightClasses(item.colorClass, isHighlighted)
              )}
              onClick={() => handleItemClick(item)}
              onMouseEnter={() => setHighlightedIndex(globalIndex)}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', getIconColorClass(item.colorClass))} />
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
    ))
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors',
          'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50',
          isOpen && 'bg-primary/20 border-primary/50',
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
            className="fixed z-50 w-96 bg-popover border border-border/50 rounded-xl shadow-xl overflow-hidden animate-fade-in"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
            onKeyDown={handleKeyDown}
          >
            {/* Tabs */}
            <div className="flex border-b border-border/30">
              <button
                type="button"
                onClick={() => setActiveTab('tables')}
                className={cn(
                  'flex-1 min-w-0 px-2 py-2 text-sm font-medium transition-colors relative',
                  activeTab === 'tables'
                    ? 'text-mint'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="flex items-center justify-center gap-1">
                  <Table2 className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">Tables</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">({tabCounts.tables})</span>
                </span>
                {activeTab === 'tables' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-mint" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={cn(
                  'flex-1 min-w-0 px-2 py-2 text-sm font-medium transition-colors relative',
                  activeTab === 'templates'
                    ? 'text-lavender'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="flex items-center justify-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">Templates</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">({tabCounts.templates})</span>
                </span>
                {activeTab === 'templates' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-lavender" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('syntax')}
                className={cn(
                  'flex-1 min-w-0 px-2 py-2 text-sm font-medium transition-colors relative',
                  activeTab === 'syntax'
                    ? 'text-amber'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="flex items-center justify-center gap-1">
                  <Dices className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">Syntax</span>
                </span>
                {activeTab === 'syntax' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber" />
                )}
              </button>
            </div>

            {/* Search Input */}
            <div className="p-2 border-b border-border/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${activeTab}...`}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* Items */}
            <div className="max-h-64 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No {activeTab} found
                </div>
              ) : (
                renderGroups()
              )}
            </div>

            {/* Keyboard Hint */}
            <div className="px-3 py-2 border-t border-border/30 bg-muted/30">
              <p className="text-xs text-muted-foreground/70">
                <kbd className="px-1 py-0.5 bg-background rounded text-[10px]">↑↓</kbd> navigate
                <span className="mx-2">·</span>
                <kbd className="px-1 py-0.5 bg-background rounded text-[10px]">Tab</kbd> switch
                <span className="mx-2">·</span>
                <kbd className="px-1 py-0.5 bg-background rounded text-[10px]">Enter</kbd> insert
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

export default InsertDropdown
