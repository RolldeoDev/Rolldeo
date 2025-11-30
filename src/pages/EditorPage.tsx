/**
 * EditorPage
 *
 * Full-featured editor for Random Table collections with workspace layout.
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useBlocker } from 'react-router-dom'
import {
  Save,
  Download,
  AlertTriangle,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCollectionStore } from '@/stores/collectionStore'
import { EditorWorkspace, formatJson, CollectionSwitcher } from '@/components/editor'
import { exportAsJson } from '@/services/export'
import type { ValidationError } from '@/components/editor'
import type { RandomTableDocument, SimpleTable } from '@/engine/types'

// Default empty document
const createDefaultDocument = (): RandomTableDocument => ({
  metadata: {
    name: '',
    namespace: '',
    version: '1.0.0',
    specVersion: '1.2',
  },
  tables: [
    {
      id: 'example',
      name: 'Example Table',
      type: 'simple',
      entries: [{ value: 'First result' }, { value: 'Second result' }],
    } as SimpleTable,
  ],
})

export function EditorPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const navigate = useNavigate()

  const { getCollectionDocument, saveCollection, collections, isInitialized } =
    useCollectionStore()

  // Editor state
  const [document, setDocument] = useState<RandomTableDocument | null>(null)
  const [jsonContent, setJsonContent] = useState('')
  const [originalJson, setOriginalJson] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Track if this is a new collection
  const isNewCollection = !collectionId

  // Load collection data
  useEffect(() => {
    if (!isInitialized) return

    setIsLoading(true)

    if (collectionId) {
      const doc = getCollectionDocument(collectionId)
      if (doc) {
        setDocument(doc)
        const json = formatJson(JSON.stringify(doc))
        setJsonContent(json)
        setOriginalJson(json)
      } else {
        // Collection not found, redirect to new
        navigate('/editor', { replace: true })
      }
    } else {
      // New collection
      const defaultDoc = createDefaultDocument()
      setDocument(defaultDoc)
      const json = formatJson(JSON.stringify(defaultDoc))
      setJsonContent(json)
      setOriginalJson(json)
    }

    setIsLoading(false)
  }, [collectionId, isInitialized, getCollectionDocument, navigate])

  // Track dirty state
  useEffect(() => {
    setIsDirty(jsonContent !== originalJson)
  }, [jsonContent, originalJson])

  // Block navigation when dirty
  const blocker = useBlocker(isDirty)

  // Sync to JSON
  const syncToJson = useCallback((doc: RandomTableDocument) => {
    const json = formatJson(JSON.stringify(doc))
    setJsonContent(json)
  }, [])

  // Handle document changes from workspace
  const handleDocumentChange = useCallback((doc: RandomTableDocument) => {
    setDocument(doc)
  }, [])

  // Handle JSON changes
  const handleJsonChange = useCallback((value: string) => {
    setJsonContent(value)
    // Try to parse and update document
    try {
      const parsed = JSON.parse(value) as RandomTableDocument
      setDocument(parsed)
    } catch {
      // Invalid JSON, don't update document
    }
  }, [])

  // Handle validation errors from JSON editor
  const handleValidationChange = useCallback((errors: ValidationError[]) => {
    setValidationErrors(errors)
  }, [])

  // Save handler
  const handleSave = useCallback(async () => {
    if (!document) return

    // Validate
    if (!document.metadata.name.trim()) {
      setSaveError('Name is required')
      return
    }
    if (!document.metadata.namespace.trim()) {
      setSaveError('Namespace is required')
      return
    }
    if (validationErrors.some((e) => e.severity === 'error')) {
      setSaveError('Please fix validation errors before saving')
      return
    }

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      // Generate collection ID from namespace if new
      const id = collectionId || document.metadata.namespace.replace(/\./g, '-')

      // Check for ID conflicts with existing collections (only for new)
      if (!collectionId && collections.has(id)) {
        setSaveError(`A collection with ID "${id}" already exists. Use a different namespace.`)
        setIsSaving(false)
        return
      }

      await saveCollection(id, document, 'user')

      // Update original JSON to mark as clean
      const savedJson = formatJson(JSON.stringify(document))
      setOriginalJson(savedJson)
      setJsonContent(savedJson)

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)

      // Navigate to the saved collection if new
      if (!collectionId) {
        navigate(`/editor/${id}`, { replace: true })
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }, [document, collectionId, collections, saveCollection, navigate, validationErrors])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  if (isLoading || !isInitialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load document</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">
            {isNewCollection ? 'Create Collection' : 'Edit Collection'}
          </h1>
          <CollectionSwitcher
            currentCollectionId={collectionId}
            isDirty={isDirty}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Validation Status */}
          {validationErrors.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              {validationErrors.filter((e) => e.severity === 'error').length > 0 && (
                <span className="text-destructive flex items-center gap-1">
                  <X className="h-4 w-4" />
                  {validationErrors.filter((e) => e.severity === 'error').length} errors
                </span>
              )}
              {validationErrors.filter((e) => e.severity === 'warning').length > 0 && (
                <span className="text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {validationErrors.filter((e) => e.severity === 'warning').length} warnings
                </span>
              )}
            </div>
          )}

          {/* Save Status */}
          {saveSuccess && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Saved
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-1 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {saveError}
            </span>
          )}

          {/* Actions */}
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium',
              isDirty
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border border-border/50 hover:bg-accent',
              isSaving && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
            {isDirty && !isSaving && (
              <span className="text-xs opacity-70">(unsaved)</span>
            )}
          </button>

          <button
            onClick={() => document && exportAsJson(document)}
            disabled={!document}
            className="flex items-center gap-2 px-4 py-2 border border-border/50 rounded-xl hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Workspace */}
      <EditorWorkspace
        document={document}
        jsonContent={jsonContent}
        onDocumentChange={handleDocumentChange}
        onJsonChange={handleJsonChange}
        onValidationChange={handleValidationChange}
        syncToJson={syncToJson}
        collectionId={collectionId}
      />

      {/* Unsaved Changes Dialog */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <h2 className="text-lg font-semibold">Unsaved Changes</h2>
            </div>
            <p className="text-muted-foreground">
              You have unsaved changes. Are you sure you want to leave? Your
              changes will be lost.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => blocker.reset?.()}
                className="px-4 py-2 border rounded-xl hover:bg-accent transition-colors"
              >
                Stay
              </button>
              <button
                onClick={() => blocker.proceed?.()}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90 transition-colors"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EditorPage
