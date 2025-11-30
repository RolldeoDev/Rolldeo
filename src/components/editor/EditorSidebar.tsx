/**
 * EditorSidebar Component
 *
 * Collapsible sidebar with file tree navigation for the editor.
 */

import { useState, useCallback } from 'react'
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

  const toggleSection = useCallback((section: 'includes' | 'tables' | 'templates') => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }, [])

  const imports = document.imports || []
  const tables = document.tables
  const templates = document.templates || []

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

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Includes Section */}
        <Section
          title="Includes"
          icon={Link2}
          count={imports.length}
          isExpanded={expandedSections.includes}
          onToggle={() => toggleSection('includes')}
          onAdd={onAddImport}
          accentColor="amber"
        >
          {imports.length === 0 ? (
            <p className="px-5 py-2 text-xs text-muted-foreground/70 italic">
              No imports yet
            </p>
          ) : (
            imports.map((imp: Import, index: number) => (
              <SidebarItem
                key={`import-${index}`}
                label={imp.alias}
                id={imp.path.split('/').pop() || imp.path}
                isSelected={selectedItemId === `import-${index}`}
                onClick={() => onNavigate('metadata', `import-${index}`)}
                onDelete={onDeleteImport ? () => onDeleteImport(index) : undefined}
              />
            ))
          )}
        </Section>

        {/* Tables Section */}
        <Section
          title="Tables"
          icon={Table2}
          count={tables.length}
          isExpanded={expandedSections.tables}
          onToggle={() => toggleSection('tables')}
          onAdd={onAddTable}
          accentColor="mint"
        >
          {tables.map((table: Table, index: number) => (
            <SidebarItem
              key={table.id}
              label={table.name}
              id={table.id}
              isSelected={selectedItemId === table.id}
              onClick={() => onNavigate('tables', table.id)}
              onDelete={onDeleteTable ? () => onDeleteTable(index) : undefined}
              canDelete={tables.length > 1}
            />
          ))}
        </Section>

        {/* Templates Section */}
        <Section
          title="Templates"
          icon={Sparkles}
          count={templates.length}
          isExpanded={expandedSections.templates}
          onToggle={() => toggleSection('templates')}
          onAdd={onAddTemplate}
          accentColor="lavender"
        >
          {templates.length === 0 ? (
            <p className="px-5 py-2 text-xs text-muted-foreground/70 italic">
              No templates yet
            </p>
          ) : (
            templates.map((template: Template, index: number) => (
              <SidebarItem
                key={template.id}
                label={template.name}
                id={template.id}
                isSelected={selectedItemId === template.id}
                onClick={() => onNavigate('templates', template.id)}
                onDelete={onDeleteTemplate ? () => onDeleteTemplate(index) : undefined}
              />
            ))
          )}
        </Section>
      </div>
    </div>
  )
}

export default EditorSidebar
