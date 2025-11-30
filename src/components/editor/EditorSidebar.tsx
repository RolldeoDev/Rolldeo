/**
 * EditorSidebar Component
 *
 * Collapsible sidebar with file tree navigation for the editor.
 */

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  ChevronDown,
  Link2,
  Table2,
  Sparkles,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Search,
  X,
} from 'lucide-react'
import type { RandomTableDocument, Import, Table, Template } from '@/engine/types'
import type { EditorTab } from './EditorTabBar'

interface EditorSidebarProps {
  document: RandomTableDocument
  isCollapsed: boolean
  onToggleCollapse: () => void
  onNavigate: (tab: EditorTab, itemId?: string) => void
  onAddImport: () => void
  onAddTable: () => void
  onAddTemplate: () => void
  onDeleteImport?: (index: number) => void
  onDeleteTable?: (index: number) => void
  onDeleteTemplate?: (index: number) => void
  selectedItemId?: string
}

interface SectionProps {
  title: string
  icon: typeof Table2
  count: number
  isExpanded: boolean
  onToggle: () => void
  onAdd: () => void
  children: React.ReactNode
  accentColor: 'mint' | 'lavender' | 'amber'
}

function Section({ title, icon: Icon, count, isExpanded, onToggle, onAdd, children, accentColor }: SectionProps) {
  const colorClasses = {
    mint: 'text-[hsl(var(--mint))]',
    lavender: 'text-[hsl(var(--lavender))]',
    amber: 'text-[hsl(var(--amber))]',
  }

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-accent/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Icon className={cn('h-4 w-4', colorClasses[accentColor])} />
        <span className="flex-1 text-left">{title}</span>
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {count}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAdd()
          }}
          className="p-1 hover:bg-primary/10 rounded transition-colors opacity-0 group-hover:opacity-100 hover:opacity-100"
          title={`Add ${title.toLowerCase().slice(0, -1)}`}
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
        </button>
      </button>
      {isExpanded && (
        <div className="pb-2 animate-slide-up">
          {children}
        </div>
      )}
    </div>
  )
}

interface SidebarItemProps {
  label: string
  id: string
  isSelected: boolean
  onClick: () => void
  onDelete?: () => void
  canDelete?: boolean
}

function SidebarItem({ label, id, isSelected, onClick, onDelete, canDelete = true }: SidebarItemProps) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-1.5 mx-2 rounded-lg text-sm cursor-pointer transition-all',
        isSelected
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
      )}
      onClick={onClick}
    >
      <span className="flex-1 truncate" title={label}>
        {label}
      </span>
      <span className="text-xs text-muted-foreground/60 font-mono truncate max-w-[60px]" title={id}>
        {id}
      </span>
      {canDelete && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-all"
          title="Delete"
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </button>
      )}
    </div>
  )
}

type FilterType = 'all' | 'includes' | 'tables' | 'templates'

export function EditorSidebar({
  document,
  isCollapsed,
  onToggleCollapse,
  onNavigate,
  onAddImport,
  onAddTable,
  onAddTemplate,
  onDeleteImport,
  onDeleteTable,
  onDeleteTemplate,
  selectedItemId,
}: EditorSidebarProps) {
  const [expandedSections, setExpandedSections] = useState({
    includes: true,
    tables: true,
    templates: true,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')

  const toggleSection = useCallback((section: 'includes' | 'tables' | 'templates') => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }, [])

  const imports = document.imports || []
  const tables = document.tables
  const templates = document.templates || []

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    const matchesQuery = (text: string) =>
      !query || text.toLowerCase().includes(query)

    const filteredImports = imports.filter((imp: Import) =>
      matchesQuery(imp.alias) || matchesQuery(imp.path)
    )

    const filteredTables = tables.filter((table: Table) =>
      matchesQuery(table.name) || matchesQuery(table.id)
    )

    const filteredTemplates = templates.filter((template: Template) =>
      matchesQuery(template.name) || matchesQuery(template.id)
    )

    return {
      imports: filterType === 'all' || filterType === 'includes' ? filteredImports : [],
      tables: filterType === 'all' || filterType === 'tables' ? filteredTables : [],
      templates: filterType === 'all' || filterType === 'templates' ? filteredTemplates : [],
    }
  }, [imports, tables, templates, searchQuery, filterType])

  const hasActiveFilter = searchQuery.length > 0 || filterType !== 'all'
  const totalResults = filteredItems.imports.length + filteredItems.tables.length + filteredItems.templates.length

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setFilterType('all')
  }, [])

  if (isCollapsed) {
    return (
      <div className="w-12 border-r border-border/50 bg-card/30 flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title="Expand sidebar"
        >
          <PanelLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="w-6 h-px bg-border/50 my-1" />
        <button
          onClick={() => onNavigate('tables')}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title={`Tables (${tables.length})`}
        >
          <Table2 className="h-4 w-4 text-[hsl(var(--mint))]" />
        </button>
        <button
          onClick={() => onNavigate('templates')}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title={`Templates (${templates.length})`}
        >
          <Sparkles className="h-4 w-4 text-[hsl(var(--lavender))]" />
        </button>
        <button
          onClick={() => onNavigate('metadata')}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title="Includes"
        >
          <Link2 className="h-4 w-4 text-[hsl(var(--amber))]" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-64 border-r border-border/50 bg-card/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 hover:bg-accent rounded-lg transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Search and Filter */}
      <div className="px-3 py-2.5 border-b border-border/30 space-y-2">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className={cn(
              'w-full pl-8 pr-8 py-1.5 text-sm rounded-lg',
              'bg-background/50 border border-border/50',
              'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
              'placeholder:text-muted-foreground/50 transition-all'
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-accent rounded transition-colors"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Type Filter Chips */}
        <div className="flex flex-wrap gap-1">
          {(['all', 'tables', 'templates', 'includes'] as const).map((type) => {
            const isActive = filterType === type
            const icons = {
              all: null,
              includes: Link2,
              tables: Table2,
              templates: Sparkles,
            }
            const colors = {
              all: '',
              includes: 'text-[hsl(var(--amber))]',
              tables: 'text-[hsl(var(--mint))]',
              templates: 'text-[hsl(var(--lavender))]',
            }
            const Icon = icons[type]
            const count = type === 'all'
              ? imports.length + tables.length + templates.length
              : type === 'includes' ? imports.length
              : type === 'tables' ? tables.length
              : templates.length

            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border transition-all',
                  isActive
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'border-border/50 text-muted-foreground hover:border-border hover:bg-accent/50'
                )}
              >
                {Icon && <Icon className={cn('h-3 w-3', isActive ? '' : colors[type])} />}
                <span className="capitalize">{type}</span>
                <span className="text-muted-foreground/60">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Results indicator when filtering */}
        {hasActiveFilter && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {totalResults} result{totalResults !== 1 ? 's' : ''}
            </span>
            <button
              onClick={clearFilters}
              className="text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Includes Section - hidden when filtered to other types */}
        {(filterType === 'all' || filterType === 'includes') && (
          <Section
            title="Includes"
            icon={Link2}
            count={filteredItems.imports.length}
            isExpanded={expandedSections.includes}
            onToggle={() => toggleSection('includes')}
            onAdd={onAddImport}
            accentColor="amber"
          >
            {filteredItems.imports.length === 0 ? (
              <p className="px-5 py-2 text-xs text-muted-foreground/70 italic">
                {hasActiveFilter ? 'No matches' : 'No imports yet'}
              </p>
            ) : (
              filteredItems.imports.map((imp: Import) => {
                const originalIndex = imports.indexOf(imp)
                return (
                  <SidebarItem
                    key={`import-${originalIndex}`}
                    label={imp.alias}
                    id={imp.path.split('/').pop() || imp.path}
                    isSelected={selectedItemId === `import-${originalIndex}`}
                    onClick={() => onNavigate('metadata', `import-${originalIndex}`)}
                    onDelete={onDeleteImport ? () => onDeleteImport(originalIndex) : undefined}
                  />
                )
              })
            )}
          </Section>
        )}

        {/* Tables Section - hidden when filtered to other types */}
        {(filterType === 'all' || filterType === 'tables') && (
          <Section
            title="Tables"
            icon={Table2}
            count={filteredItems.tables.length}
            isExpanded={expandedSections.tables}
            onToggle={() => toggleSection('tables')}
            onAdd={onAddTable}
            accentColor="mint"
          >
            {filteredItems.tables.length === 0 ? (
              <p className="px-5 py-2 text-xs text-muted-foreground/70 italic">
                {hasActiveFilter ? 'No matches' : 'No tables yet'}
              </p>
            ) : (
              filteredItems.tables.map((table: Table) => {
                const originalIndex = tables.indexOf(table)
                return (
                  <SidebarItem
                    key={table.id}
                    label={table.name}
                    id={table.id}
                    isSelected={selectedItemId === table.id}
                    onClick={() => onNavigate('tables', table.id)}
                    onDelete={onDeleteTable ? () => onDeleteTable(originalIndex) : undefined}
                    canDelete={tables.length > 1}
                  />
                )
              })
            )}
          </Section>
        )}

        {/* Templates Section - hidden when filtered to other types */}
        {(filterType === 'all' || filterType === 'templates') && (
          <Section
            title="Templates"
            icon={Sparkles}
            count={filteredItems.templates.length}
            isExpanded={expandedSections.templates}
            onToggle={() => toggleSection('templates')}
            onAdd={onAddTemplate}
            accentColor="lavender"
          >
            {filteredItems.templates.length === 0 ? (
              <p className="px-5 py-2 text-xs text-muted-foreground/70 italic">
                {hasActiveFilter ? 'No matches' : 'No templates yet'}
              </p>
            ) : (
              filteredItems.templates.map((template: Template) => {
                const originalIndex = templates.indexOf(template)
                return (
                  <SidebarItem
                    key={template.id}
                    label={template.name}
                    id={template.id}
                    isSelected={selectedItemId === template.id}
                    onClick={() => onNavigate('templates', template.id)}
                    onDelete={onDeleteTemplate ? () => onDeleteTemplate(originalIndex) : undefined}
                  />
                )
              })
            )}
          </Section>
        )}
      </div>
    </div>
  )
}

export default EditorSidebar
