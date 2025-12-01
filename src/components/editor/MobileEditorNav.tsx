/**
 * MobileEditorNav Component
 *
 * A touch-friendly navigation overlay for mobile devices.
 * Features a floating action button that opens a full-screen navigation drawer.
 */

import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Menu,
  X,
  Table2,
  Sparkles,
  Link2,
  Plus,
  ChevronRight,
  FileText,
  Variable,
  Code,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RandomTableDocument } from '@/engine/types'
import type { EditorTab } from './EditorTabBar'

interface MobileEditorNavProps {
  document: RandomTableDocument
  activeTab: EditorTab
  onNavigate: (tab: EditorTab, itemId?: string) => void
  onAddTable: () => void
  onAddTemplate: () => void
  onAddImport: () => void
  selectedItemId?: string
}

export function MobileEditorNav({
  document: docData,
  activeTab,
  onNavigate,
  onAddTable,
  onAddTemplate,
  onAddImport,
  selectedItemId,
}: MobileEditorNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      window.document.body.style.overflow = 'hidden'
    } else {
      window.document.body.style.overflow = ''
    }
    return () => {
      window.document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsOpen(false)
      setIsClosing(false)
      setSearchQuery('')
    }, 250)
  }, [])

  const handleNavigate = useCallback(
    (tab: EditorTab, itemId?: string) => {
      onNavigate(tab, itemId)
      handleClose()
    },
    [onNavigate, handleClose]
  )

  const handleAdd = useCallback(
    (type: 'table' | 'template' | 'import') => {
      if (type === 'table') onAddTable()
      else if (type === 'template') onAddTemplate()
      else onAddImport()
      handleClose()
    },
    [onAddTable, onAddTemplate, onAddImport, handleClose]
  )

  // Filter items based on search
  const imports = docData.imports || []
  const tables = docData.tables
  const templates = docData.templates || []

  const filteredTables = searchQuery
    ? tables.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tables

  const filteredTemplates = searchQuery
    ? templates.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : templates

  const filteredImports = searchQuery
    ? imports.filter(
        (i) =>
          i.alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.path.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : imports

  // Tab items for quick navigation
  const tabs: { id: EditorTab; label: string; icon: typeof FileText }[] = [
    { id: 'metadata', label: 'Metadata', icon: FileText },
    { id: 'tables', label: 'Tables', icon: Table2 },
    { id: 'templates', label: 'Templates', icon: Sparkles },
    { id: 'variables', label: 'Variables', icon: Variable },
    { id: 'json', label: 'JSON', icon: Code },
  ]

  const overlay = (
    <div className="mobile-overlay" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className={cn(
          'mobile-overlay-backdrop',
          isClosing ? 'mobile-backdrop-exit' : 'mobile-backdrop-enter'
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Content panel */}
      <div
        className={cn(
          'mobile-overlay-content',
          isClosing ? 'mobile-nav-exit' : 'mobile-nav-enter'
        )}
      >
        {/* Header */}
        <div className="mobile-overlay-header">
          <h2 className="text-lg font-semibold">Navigator</h2>
          <button
            onClick={handleClose}
            className="mobile-action-btn"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tables, templates..."
              className="w-full pl-10 pr-4 py-3 text-base rounded-xl bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-accent"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="mobile-overlay-body">
          {/* Quick tabs */}
          {!searchQuery && (
            <div className="p-3 space-y-1">
              <div className="mobile-section-header !static !bg-transparent !border-0 !p-0 !mb-2">
                Quick Access
              </div>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleNavigate(tab.id)}
                  className={cn(
                    'mobile-list-item w-full',
                    activeTab === tab.id && 'bg-primary/10'
                  )}
                >
                  <tab.icon
                    className={cn(
                      'h-5 w-5',
                      activeTab === tab.id
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    )}
                  />
                  <span
                    className={cn(
                      'flex-1 text-left font-medium',
                      activeTab === tab.id && 'text-primary'
                    )}
                  >
                    {tab.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </button>
              ))}
            </div>
          )}

          {/* Tables section */}
          {filteredTables.length > 0 && (
            <div className="p-3 pt-0">
              <div className="mobile-section-header !static !bg-transparent !border-0 !p-0 !mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-[hsl(var(--mint))]" />
                  Tables ({filteredTables.length})
                </span>
                {!searchQuery && (
                  <button
                    onClick={() => handleAdd('table')}
                    className="p-1.5 rounded-lg hover:bg-accent"
                    aria-label="Add table"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {filteredTables.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => handleNavigate('tables', table.id)}
                    className={cn(
                      'mobile-list-item w-full',
                      selectedItemId === table.id && 'bg-primary/10'
                    )}
                  >
                    <div className="flex-1 text-left min-w-0">
                      <div
                        className={cn(
                          'font-medium truncate',
                          selectedItemId === table.id && 'text-primary'
                        )}
                      >
                        {table.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {table.id}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {table.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Templates section */}
          {filteredTemplates.length > 0 && (
            <div className="p-3 pt-0">
              <div className="mobile-section-header !static !bg-transparent !border-0 !p-0 !mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[hsl(var(--lavender))]" />
                  Templates ({filteredTemplates.length})
                </span>
                {!searchQuery && (
                  <button
                    onClick={() => handleAdd('template')}
                    className="p-1.5 rounded-lg hover:bg-accent"
                    aria-label="Add template"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleNavigate('templates', template.id)}
                    className={cn(
                      'mobile-list-item w-full',
                      selectedItemId === template.id && 'bg-primary/10'
                    )}
                  >
                    <div className="flex-1 text-left min-w-0">
                      <div
                        className={cn(
                          'font-medium truncate',
                          selectedItemId === template.id && 'text-primary'
                        )}
                      >
                        {template.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {template.id}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Imports section */}
          {filteredImports.length > 0 && (
            <div className="p-3 pt-0">
              <div className="mobile-section-header !static !bg-transparent !border-0 !p-0 !mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-[hsl(var(--amber))]" />
                  Includes ({filteredImports.length})
                </span>
                {!searchQuery && (
                  <button
                    onClick={() => handleAdd('import')}
                    className="p-1.5 rounded-lg hover:bg-accent"
                    aria-label="Add import"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {filteredImports.map((imp, index) => (
                  <button
                    key={`import-${index}`}
                    onClick={() => handleNavigate('metadata', `import-${index}`)}
                    className="mobile-list-item w-full"
                  >
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium truncate">{imp.alias}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {imp.path}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty search state */}
          {searchQuery &&
            filteredTables.length === 0 &&
            filteredTemplates.length === 0 &&
            filteredImports.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No results found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="mobile-fab mobile-only animate-fab-float"
        aria-label="Open navigation"
        aria-expanded={isOpen}
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Portal the overlay to body */}
      {isOpen && createPortal(overlay, window.document.body)}
    </>
  )
}

export default MobileEditorNav
