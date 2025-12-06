/**
 * LibraryPage
 *
 * Browse and manage table collections with advanced organization features.
 * Supports grid view, namespace-grouped view, and comprehensive filtering.
 */

import { useMemo, useState, useCallback } from 'react'
import { FolderOpen, Loader2, BookOpen, Layers, ChevronDown, ChevronRight } from 'lucide-react'
import { useCollections } from '../hooks/useCollections'
import { useKeyboardShortcuts, type KeyboardShortcut } from '../hooks'
import { useUIStore } from '../stores/uiStore'
import { useCollectionStore } from '../stores/collectionStore'
import { DropZone, ImportDialog } from '../components/upload'
import { SEO } from '../components/common'
import { PAGE_SEO } from '../lib/seo'
import {
  LibraryFilterBar,
  CollectionCard,
  NamespaceAccordion,
  ConfirmDeleteDialog,
} from '../components/library'
import { generateUniqueId } from '../services/import'
import { exportAsJson, exportAsZip } from '../services/export'
import type { ImportResult, ImportedCollection } from '../services/import'
import type { CollectionMeta } from '../stores/collectionStore'

export function LibraryPage() {
  const {
    collections,
    preloaded,
    userCollections,
    allTags,
    allNamespaces,
    groupedCollections,
    isLoading,
    isInitialized,
    error,
    deleteCollection,
  } = useCollections()

  const { importFiles, saveImportedCollections, getCollectionDocument } = useCollectionStore()
  const storeCollections = useCollectionStore((state) => state.collections)

  const existingIds = useMemo(
    () => new Set(storeCollections.keys()),
    [storeCollections]
  )

  const {
    libraryViewMode,
    preloadedCollectionsExpanded,
    togglePreloadedCollections,
  } = useUIStore()

  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Get total count before filtering
  const totalCount = useMemo(() => {
    return Array.from(storeCollections.values()).length
  }, [storeCollections])

  // Get selected collections metadata
  const selectedCollections = useMemo<CollectionMeta[]>(() => {
    return Array.from(selectedIds)
      .map((id) => collections.find((c) => c.id === id))
      .filter((c): c is CollectionMeta => c !== undefined)
  }, [selectedIds, collections])

  // Get deletable collections (non-preloaded)
  const deletableCollections = useMemo<CollectionMeta[]>(() => {
    return selectedCollections.filter((c) => !c.isPreloaded)
  }, [selectedCollections])

  // Count of preloaded collections that will be skipped
  const skippedCount = selectedCollections.length - deletableCollections.length

  // Selection handlers
  const handleSelectionChange = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(collections.map((c) => c.id)))
  }, [collections])

  const handleSelectNone = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleBatchDelete = useCallback(() => {
    if (deletableCollections.length > 0) {
      setShowDeleteDialog(true)
    }
  }, [deletableCollections.length])

  const confirmBatchDelete = useCallback(async () => {
    setIsDeleting(true)
    try {
      for (const collection of deletableCollections) {
        await deleteCollection(collection.id)
      }
      setSelectedIds(new Set())
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }, [deletableCollections, deleteCollection])

  const handleBatchExport = useCallback(async () => {
    const collectionsToExport = selectedCollections
      .map((meta) => {
        const doc = getCollectionDocument(meta.id)
        return doc ? { id: meta.id, document: doc } : null
      })
      .filter((c): c is { id: string; document: NonNullable<ReturnType<typeof getCollectionDocument>> } => c !== null)

    if (collectionsToExport.length === 0) return

    if (collectionsToExport.length === 1) {
      exportAsJson(collectionsToExport[0].document)
    } else {
      await exportAsZip(collectionsToExport, 'rolldeo-collections.zip')
    }

    setSelectedIds(new Set())
  }, [selectedCollections, getCollectionDocument])

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setIsImporting(true)
    setShowImportDialog(true)

    try {
      const result = await importFiles(files)

      const processedCollections: ImportedCollection[] = result.collections.map(
        (c) => ({
          ...c,
          id: generateUniqueId(c.id, existingIds),
        })
      )

      const updatedPathToIdMap = new Map<string, string>()
      if (result.pathToIdMap) {
        for (const [path, oldId] of result.pathToIdMap) {
          const originalCollection = result.collections.find((c) => c.id === oldId)
          const processedCollection = processedCollections.find(
            (c) => c.fileName === originalCollection?.fileName
          )
          if (processedCollection) {
            updatedPathToIdMap.set(path, processedCollection.id)
          }
        }
      }

      if (processedCollections.length > 0) {
        const source = files.some((f) => f.name.endsWith('.zip')) ? 'zip' : 'file'
        await saveImportedCollections(processedCollections, source, updatedPathToIdMap)
      }

      setImportResult({
        ...result,
        collections: processedCollections,
      })
    } catch (error) {
      setImportResult({
        success: false,
        collections: [],
        errors: [
          {
            fileName: 'Import',
            error: error instanceof Error ? error.message : 'Import failed',
          },
        ],
      })
    } finally {
      setIsImporting(false)
    }
  }, [importFiles, saveImportedCollections, existingIds])

  const handleCloseDialog = useCallback(() => {
    setShowImportDialog(false)
    setImportResult(null)
  }, [])

  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      {
        key: 'Slash',
        handler: () => {
          // Focus will be handled by the filter bar
          const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement
          searchInput?.focus()
        },
        description: 'Focus search',
      },
    ],
    []
  )

  useKeyboardShortcuts({ shortcuts })

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      await deleteCollection(id)
    }
  }, [deleteCollection])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <SEO {...PAGE_SEO.library} />
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-1">Library</h1>
          <p className="text-muted-foreground">Browse and manage your table collections</p>
        </div>

      {/* Import dropzone - always visible at top */}
      <DropZone
        variant="compact"
        onFilesSelected={handleFilesSelected}
        disabled={isImporting}
      />

      {/* Filter bar with search, namespace dropdown, view toggle, and tags */}
      <LibraryFilterBar
        allNamespaces={allNamespaces}
        allTags={allTags}
        totalCount={totalCount}
        filteredCount={collections.length}
        selectedCount={selectedIds.size}
        deletableCount={deletableCollections.length}
        onDelete={handleBatchDelete}
        onExport={handleBatchExport}
        onSelectAll={handleSelectAll}
        onSelectNone={handleSelectNone}
      />

      {/* Loading state */}
      {isLoading && !isInitialized && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading collections...</p>
          </div>
        </div>
      )}

      {/* Content based on view mode */}
      {isInitialized && (
        <>
          {libraryViewMode === 'grouped' ? (
            /* Grouped View - Namespace Accordion */
            <NamespaceAccordion
              groupedCollections={groupedCollections}
              onDeleteCollection={handleDelete}
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
            />
          ) : (
            /* Grid View - Original Layout */
            <>
              {/* User Collections */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="icon-container icon-mint">
                    <Layers className="h-4 w-4" />
                  </div>
                  <h2 className="text-xl font-semibold">Your Collections</h2>
                  <span className="text-sm text-muted-foreground">({userCollections.length})</span>
                </div>
                {userCollections.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {userCollections.map((collection, index) => (
                      <CollectionCard
                        key={collection.id}
                        collection={collection}
                        onDelete={() => handleDelete(collection.id, collection.name)}
                        index={index}
                        isSelected={selectedIds.has(collection.id)}
                        onSelectionChange={handleSelectionChange}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="card-elevated border border-dashed border-white/10 p-8 text-center">
                    <div className="icon-container icon-mint mx-auto mb-4 w-fit">
                      <FolderOpen className="h-6 w-6" />
                    </div>
                    <p className="text-muted-foreground">
                      No collections match your filters
                    </p>
                  </div>
                )}
              </section>

              {/* Pre-loaded Collections - Collapsible */}
              {preloaded.length > 0 && (
                <section className="space-y-4">
                  <button
                    onClick={togglePreloadedCollections}
                    className="flex items-center gap-3 w-full text-left group"
                  >
                    <div className="icon-container icon-lavender">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <h2 className="text-xl font-semibold group-hover:text-foreground transition-colors">
                      Pre-loaded Collections
                    </h2>
                    <span className="text-sm text-muted-foreground">({preloaded.length})</span>
                    <div className="ml-auto text-muted-foreground group-hover:text-foreground transition-colors">
                      {preloadedCollectionsExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </div>
                  </button>
                  {preloadedCollectionsExpanded && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-slide-up">
                      {preloaded.map((collection, index) => (
                        <CollectionCard
                          key={collection.id}
                          collection={collection}
                          index={index}
                          isSelected={selectedIds.has(collection.id)}
                          onSelectionChange={handleSelectionChange}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          {/* Empty state */}
          {collections.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No collections found. Try clearing your filters.</p>
            </div>
          )}
        </>
      )}

      {/* Import Dialog */}
      <ImportDialog
        isOpen={showImportDialog}
        onClose={handleCloseDialog}
        result={importResult}
        isImporting={isImporting}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmBatchDelete}
        collections={deletableCollections}
        skippedCount={skippedCount}
        isDeleting={isDeleting}
      />
      </div>
    </>
  )
}
