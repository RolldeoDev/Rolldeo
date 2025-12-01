/**
 * EditorWorkspace Component
 *
 * Main layout container with sidebar, tabs, and content area.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { EditorSidebar } from './EditorSidebar'
import { EditorTabBar } from './EditorTabBar'
import { MobileEditorNav } from './MobileEditorNav'
import { useUIStore, type EditorTab } from '@/stores/uiStore'
import { MetadataEditor } from './MetadataEditor'
import { TableEditor } from './TableEditor'
import { TemplateEditor } from './TemplateEditor'
import { VariablesEditor } from './VariablesEditor'
import { IncludesEditor } from './IncludesEditor'
import { JsonEditor } from './JsonEditor'
import { Plus, FileUp } from 'lucide-react'
import { TableImportModal } from './TableImportModal'
import type { ValidationError } from './JsonEditor'
import type {
  RandomTableDocument,
  Metadata,
  Table,
  Template,
  Import,
  SimpleTable,
} from '@/engine/types'
import { useCollectionStore } from '@/stores/collectionStore'
import type { ImportedTableInfo, ImportedTemplateInfo } from '@/engine/core'

interface EditorWorkspaceProps {
  document: RandomTableDocument
  jsonContent: string
  onDocumentChange: (doc: RandomTableDocument) => void
  onJsonChange: (json: string) => void
  onValidationChange: (errors: ValidationError[]) => void
  syncToJson: (doc: RandomTableDocument) => void
  /** Collection ID for live preview in templates */
  collectionId?: string
}

export function EditorWorkspace({
  document,
  jsonContent,
  onDocumentChange,
  onJsonChange,
  onValidationChange,
  syncToJson,
  collectionId,
}: EditorWorkspaceProps) {
  // Use persisted state from UI store
  const activeTab = useUIStore((state) => state.editorActiveTab)
  const setActiveTab = useUIStore((state) => state.setEditorActiveTab)
  const sidebarCollapsed = useUIStore((state) => state.editorSidebarCollapsed)
  const setSidebarCollapsed = useUIStore((state) => state.setEditorSidebarCollapsed)
  const setSelectedItemId = useUIStore((state) => state.setEditorSelectedItemId)
  const focusedItemId = useUIStore((state) => state.editorFocusedItemId)
  const setFocusedItemId = useUIStore((state) => state.setEditorFocusedItemId)
  const lastExplicitItemId = useUIStore((state) => state.editorLastExplicitItemId)
  const setLastExplicitItemId = useUIStore((state) => state.setEditorLastExplicitItemId)
  const contentRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importsVersion, setImportsVersion] = useState(0)
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [isScrollingToExplicit, setIsScrollingToExplicit] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle expansion state changes from TableEditor/TemplateEditor
  const handleExpandChange = useCallback(
    (itemId: string, isExpanded: boolean) => {
      setExpandedItems((prev) => {
        const next = new Set(prev)
        if (isExpanded) {
          next.add(itemId)
          // When manually expanding, also set as explicit selection
          setLastExplicitItemId(itemId)
        } else {
          next.delete(itemId)
        }
        return next
      })
    },
    [setLastExplicitItemId]
  )

  // Compute the currently selected item based on priority:
  // 1. Explicit navigation in progress (scrolling to clicked item)
  // 2. Focused item (highest priority during normal use)
  // 3. First visible AND expanded item in viewport (by document order)
  // 4. Last explicitly selected item (fallback)
  const computedSelectedItemId = useMemo(() => {
    // Only compute for tables/templates tabs
    if (activeTab !== 'tables' && activeTab !== 'templates') {
      return lastExplicitItemId
    }

    // Priority 1: If we're scrolling to an explicit selection, always use it
    // This prevents viewport changes during scroll animation from hijacking selection
    if (isScrollingToExplicit && lastExplicitItemId) {
      return lastExplicitItemId
    }

    // Priority 2: Focused item
    if (focusedItemId) return focusedItemId

    // Priority 3: First visible AND expanded item (by document order)
    // Only consider expanded items for viewport-based selection
    const items =
      activeTab === 'tables'
        ? document.tables.map((t) => t.id)
        : (document.templates || []).map((t) => t.id)

    const firstVisibleExpanded = items.find(
      (id) => visibleItems.has(id) && expandedItems.has(id)
    )
    if (firstVisibleExpanded) return firstVisibleExpanded

    // Priority 4: Last explicitly selected
    return lastExplicitItemId
  }, [focusedItemId, visibleItems, expandedItems, activeTab, document.tables, document.templates, lastExplicitItemId, isScrollingToExplicit])

  // Update the UIStore selectedItemId whenever computed value changes
  useEffect(() => {
    setSelectedItemId(computedSelectedItemId)
  }, [computedSelectedItemId, setSelectedItemId])

  // Scroll to item when explicitly selected from sidebar
  useEffect(() => {
    if (lastExplicitItemId && contentRef.current) {
      const element = contentRef.current.querySelector(`[data-item-id="${lastExplicitItemId}"]`)
      if (element) {
        // Set scrolling flag to prevent viewport changes from hijacking selection
        setIsScrollingToExplicit(true)

        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }

        element.scrollIntoView({ behavior: 'smooth', block: 'start' })

        // Clear the flag after scroll animation completes (generous timeout for smooth scroll)
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrollingToExplicit(false)
        }, 800)
      }
    }

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [lastExplicitItemId])

  // Track visible items with IntersectionObserver
  useEffect(() => {
    if (activeTab !== 'tables' && activeTab !== 'templates') {
      return
    }

    // Reset visible items when tab or document changes
    setVisibleItems(new Set())

    // Small delay to allow DOM to render
    const timeoutId = setTimeout(() => {
      if (!contentRef.current) return

      observerRef.current = new IntersectionObserver(
        (entries) => {
          setVisibleItems((prev) => {
            const next = new Set(prev)
            entries.forEach((entry) => {
              const id = entry.target.getAttribute('data-item-id')
              if (id) {
                if (entry.isIntersecting) {
                  next.add(id)
                } else {
                  next.delete(id)
                }
              }
            })
            return next
          })
        },
        { root: contentRef.current, threshold: 0.1 }
      )

      // Observe all item containers
      contentRef.current.querySelectorAll('[data-item-id]').forEach((el) => {
        observerRef.current?.observe(el)
      })
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      observerRef.current?.disconnect()
    }
  }, [activeTab, document.tables, document.templates])

  // Sync document imports to engine when they change (for live import resolution)
  // We need to ensure the document matches the collectionId to avoid corrupting
  // engine state during collection switches (when collectionId changes before document)
  useEffect(() => {
    if (collectionId) {
      // Verify the document belongs to this collection by checking namespace match
      const collectionMeta = useCollectionStore.getState().getCollection(collectionId)
      if (collectionMeta && document.metadata.namespace === collectionMeta.namespace) {
        useCollectionStore.getState().updateCollectionDocument(collectionId, document)
        // Increment version to trigger memo re-evaluation after engine update
        setImportsVersion((v) => v + 1)
      }
    }
  }, [collectionId, document.imports, document.metadata.namespace])

  // Available table IDs for references
  const availableTableIds = useMemo(() => {
    return document.tables.map((t) => t.id)
  }, [document.tables])

  // Available template IDs
  const availableTemplateIds = useMemo(() => {
    return (document.templates || []).map((t) => t.id)
  }, [document.templates])

  // Imported tables from resolved imports
  // Note: importsVersion triggers re-evaluation after engine update
  const importedTables = useMemo((): ImportedTableInfo[] => {
    if (!collectionId) return []
    return useCollectionStore.getState().getImportedTableList(collectionId, true)
  }, [collectionId, importsVersion])

  // Imported templates from resolved imports
  const importedTemplates = useMemo((): ImportedTemplateInfo[] => {
    if (!collectionId) return []
    return useCollectionStore.getState().getImportedTemplateList(collectionId)
  }, [collectionId, importsVersion])

  // Update handlers
  const updateMetadata = useCallback(
    (metadata: Metadata) => {
      const updated = { ...document, metadata }
      onDocumentChange(updated)
      syncToJson(updated)
    },
    [document, onDocumentChange, syncToJson]
  )

  const updateImports = useCallback(
    (imports: Import[]) => {
      const updated = { ...document, imports: imports.length > 0 ? imports : undefined }
      onDocumentChange(updated)
      syncToJson(updated)
    },
    [document, onDocumentChange, syncToJson]
  )

  const updateTables = useCallback(
    (tables: Table[]) => {
      const updated = { ...document, tables }
      onDocumentChange(updated)
      syncToJson(updated)
    },
    [document, onDocumentChange, syncToJson]
  )

  const updateTemplates = useCallback(
    (templates: Template[]) => {
      const updated = { ...document, templates: templates.length > 0 ? templates : undefined }
      onDocumentChange(updated)
      syncToJson(updated)
    },
    [document, onDocumentChange, syncToJson]
  )

  const updateVariables = useCallback(
    (variables: Record<string, string>) => {
      const updated = {
        ...document,
        variables: Object.keys(variables).length > 0 ? variables : undefined,
      }
      onDocumentChange(updated)
      syncToJson(updated)
    },
    [document, onDocumentChange, syncToJson]
  )

  const updateShared = useCallback(
    (shared: Record<string, string>) => {
      const updated = {
        ...document,
        shared: Object.keys(shared).length > 0 ? shared : undefined,
      }
      onDocumentChange(updated)
      syncToJson(updated)
    },
    [document, onDocumentChange, syncToJson]
  )

  // Add handlers
  const addImport = useCallback(() => {
    const imports = document.imports || []
    const newImport: Import = {
      path: '',
      alias: `import${imports.length + 1}`,
    }
    updateImports([...imports, newImport])
    setActiveTab('metadata')
  }, [document.imports, updateImports])

  const addTable = useCallback(() => {
    const newId = `table${document.tables.length + 1}`
    const newTable: SimpleTable = {
      id: newId,
      name: 'New Table',
      type: 'simple',
      entries: [{ value: 'New entry' }],
    }
    updateTables([...document.tables, newTable])
    setActiveTab('tables')
    setLastExplicitItemId(newId)
  }, [document.tables, updateTables, setActiveTab, setLastExplicitItemId])

  const handleImportTable = useCallback(
    (table: SimpleTable) => {
      // Ensure unique ID (append number if collision)
      const existingIds = document.tables.map((t) => t.id)
      let uniqueId = table.id
      let counter = 1
      while (existingIds.includes(uniqueId)) {
        uniqueId = `${table.id}${counter++}`
      }

      const tableWithUniqueId = { ...table, id: uniqueId }
      updateTables([...document.tables, tableWithUniqueId])
      setActiveTab('tables')
      setLastExplicitItemId(uniqueId)
    },
    [document.tables, updateTables, setActiveTab, setLastExplicitItemId]
  )

  const addTemplate = useCallback(() => {
    const templates = document.templates || []
    const newId = `template${templates.length + 1}`
    const newTemplate: Template = {
      id: newId,
      name: 'New Template',
      pattern: 'You encounter {{example}}!',
    }
    updateTemplates([...templates, newTemplate])
    setActiveTab('templates')
    setLastExplicitItemId(newId)
  }, [document.templates, updateTemplates, setActiveTab, setLastExplicitItemId])

  // Delete handlers
  const deleteImport = useCallback(
    (index: number) => {
      const imports = document.imports || []
      updateImports(imports.filter((_, i) => i !== index))
    },
    [document.imports, updateImports]
  )

  const deleteTable = useCallback(
    (index: number) => {
      if (document.tables.length <= 1) {
        alert('Cannot delete the last table. A collection must have at least one table.')
        return
      }
      updateTables(document.tables.filter((_, i) => i !== index))
    },
    [document.tables, updateTables]
  )

  const deleteTemplate = useCallback(
    (index: number) => {
      const templates = document.templates || []
      updateTemplates(templates.filter((_, i) => i !== index))
    },
    [document.templates, updateTemplates]
  )

  // Table/Template update handlers
  const updateTable = useCallback(
    (index: number, table: Table) => {
      const tables = [...document.tables]
      tables[index] = table
      updateTables(tables)
    },
    [document.tables, updateTables]
  )

  const updateTemplate = useCallback(
    (index: number, template: Template) => {
      const templates = [...(document.templates || [])]
      templates[index] = template
      updateTemplates(templates)
    },
    [document.templates, updateTemplates]
  )

  // Navigation from sidebar
  const handleNavigate = useCallback((tab: EditorTab, itemId?: string) => {
    setActiveTab(tab)
    if (itemId) {
      setLastExplicitItemId(itemId)
    }
  }, [setActiveTab, setLastExplicitItemId])

  const tableCounts = {
    tables: document.tables.length,
    templates: document.templates?.length || 0,
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] md:h-[calc(100vh-12rem)] h-[calc(100vh-8rem)] border rounded-2xl overflow-hidden bg-background">
      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:flex h-full">
        <EditorSidebar
          document={document}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onNavigate={handleNavigate}
          onAddImport={addImport}
          onAddTable={addTable}
          onAddTemplate={addTemplate}
          onDeleteImport={deleteImport}
          onDeleteTable={deleteTable}
          onDeleteTemplate={deleteTemplate}
          selectedItemId={computedSelectedItemId ?? undefined}
        />
      </div>

      {/* Mobile Navigation FAB + Overlay */}
      <MobileEditorNav
        document={document}
        activeTab={activeTab}
        onNavigate={handleNavigate}
        onAddTable={addTable}
        onAddTemplate={addTemplate}
        onAddImport={addImport}
        selectedItemId={computedSelectedItemId ?? undefined}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab Bar */}
        <EditorTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tableCounts={tableCounts}
        />

        {/* Content Area */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === 'metadata' && (
            <div className="space-y-8 animate-fade-in">
              {/* Metadata */}
              <section>
                <h2 className="text-lg font-semibold mb-4">Collection Metadata</h2>
                <MetadataEditor value={document.metadata} onChange={updateMetadata} />
              </section>

              {/* Includes */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Includes</h2>
                  <button
                    onClick={addImport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-accent transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Import
                  </button>
                </div>
                <IncludesEditor
                  imports={document.imports || []}
                  onChange={updateImports}
                  currentNamespace={document.metadata.namespace}
                />
              </section>
            </div>
          )}

          {activeTab === 'tables' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Tables ({document.tables.length})</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-accent transition-colors"
                  >
                    <FileUp className="h-4 w-4" />
                    Import Table
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-medium">
                      BETA
                    </span>
                  </button>
                  <button
                    onClick={addTable}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-accent transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Table
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {document.tables.map((table, index) => (
                  <div key={`table-${index}`} data-item-id={table.id}>
                    <TableEditor
                      table={table}
                      onChange={(updated) => updateTable(index, updated)}
                      onDelete={() => deleteTable(index)}
                      availableTableIds={availableTableIds}
                      defaultExpanded={lastExplicitItemId === table.id || document.tables.length === 1}
                      collectionId={collectionId}
                      onFocus={() => setFocusedItemId(table.id)}
                      onBlur={() => setFocusedItemId(null)}
                      onExpandChange={(isExpanded) => handleExpandChange(table.id, isExpanded)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Templates ({document.templates?.length || 0})
                </h2>
                <button
                  onClick={addTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-accent transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Template
                </button>
              </div>

              {(document.templates?.length || 0) > 0 ? (
                <div className="space-y-4">
                  {document.templates?.map((template, index) => (
                    <div key={`template-${index}`} data-item-id={template.id}>
                      <TemplateEditor
                        template={template}
                        onChange={(updated) => updateTemplate(index, updated)}
                        onDelete={() => deleteTemplate(index)}
                        availableTableIds={availableTableIds}
                        availableTemplateIds={availableTemplateIds}
                        importedTables={importedTables}
                        importedTemplates={importedTemplates}
                        defaultExpanded={lastExplicitItemId === template.id || (document.templates?.length || 0) === 1}
                        collectionId={collectionId}
                        onFocus={() => setFocusedItemId(template.id)}
                        onBlur={() => setFocusedItemId(null)}
                        onExpandChange={(isExpanded) => handleExpandChange(template.id, isExpanded)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground">
                  <p>No templates yet. Click "Add Template" to create one.</p>
                  <p className="text-sm mt-2">
                    Templates combine multiple tables using patterns like{' '}
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">
                      {'{{tableId}}'}
                    </code>
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'variables' && (
            <div className="animate-fade-in">
              <h2 className="text-lg font-semibold mb-4">Variables</h2>
              <VariablesEditor
                variables={document.variables || {}}
                shared={document.shared || {}}
                onVariablesChange={updateVariables}
                onSharedChange={updateShared}
                collectionId={collectionId}
              />
            </div>
          )}

          {activeTab === 'json' && (
            <div className="animate-fade-in h-full flex flex-col">
              <JsonEditor
                value={jsonContent}
                onChange={onJsonChange}
                onValidationChange={onValidationChange}
                height="calc(100vh - 20rem)"
                filename={`${document.metadata.namespace || 'untitled'}.json`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Table Import Modal */}
      <TableImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportTable}
      />
    </div>
  )
}

export default EditorWorkspace
