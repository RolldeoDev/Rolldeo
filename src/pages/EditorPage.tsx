/**
 * EditorPage
 *
 * Full-featured editor for Random Table collections with workspace layout.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { useParams, useNavigate, useBlocker, useLocation } from 'react-router-dom'
import {
  Save,
  Download,
  AlertTriangle,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseDraftSnapshot, savedDraftState } from '@/components/editor/draftState'
import { Modal } from '@/components/common/Modal'
import { SEO } from '@/components/common'
import { PAGE_SEO } from '@/lib/seo'
import { useCollectionStore } from '@/stores/collectionStore'
import { useUIStore } from '@/stores/uiStore'
import { EditorWorkspace, formatJson, validateJsonSyntax, CollectionSwitcher, EditorHelpButton, ExportDialog } from '@/components/editor'
import { exportAsJson } from '@/services/export'
import { validateDocument } from '@/engine/core/validator'
import type { ValidationError } from '@/components/editor'
import type { AuthoredRandomTableDocument as RandomTableDocument, SimpleTable } from '@/engine/types'

// Default empty document
const createDefaultDocument = (): RandomTableDocument => ({
  metadata: {
    name: '',
    namespace: '',
    version: '1.0.0',
    specVersion: '1.0',
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
  const location = useLocation()

  const { getCollectionDocument, saveCollection, collections, isInitialized } =
    useCollectionStore()

  const lastEditorCollectionId = useUIStore((state) => state.lastEditorCollectionId)
  const setLastEditorCollectionId = useUIStore((state) => state.setLastEditorCollectionId)

  // Editor state
  const [document, setDocument] = useState<RandomTableDocument | null>(null)
  const [jsonContent, setJsonContent] = useState('')
  const [documentAvailable, setDocumentAvailable] = useState(true)
  const latestJson = useRef('')
  const saveInProgress = useRef(false)
  const documentSession = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const savedNewRoute = useRef<string | null>(null)
  const [exportDocument, setExportDocument] = useState<RandomTableDocument | null>(null)
  const [originalJson, setOriginalJson] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const validationErrors = useMemo((): ValidationError[] => {
    const syntax = validateJsonSyntax(jsonContent)
    if (syntax) return [syntax]
    return validateDocument(JSON.parse(jsonContent)).issues.map(issue => ({
      line: 1, column: 1, message: issue.message, severity: issue.severity,
    }))
  }, [jsonContent])
  const [isLoading, setIsLoading] = useState(true)
  const [showExportDialog, setShowExportDialog] = useState(false)

  // Track if this is a new collection
  const isNewCollection = !collectionId

  // Redirect to last edited collection if none specified
  // Skip redirect if user explicitly clicked "New Collection" (intent: 'new')
  const locationState = location.state as { intent?: string } | null
  const isIntentNew = locationState?.intent === 'new'

  useEffect(() => {
    if (!isInitialized) return

    // Don't redirect if user explicitly wants a new collection
    if (isIntentNew) return

    if (!collectionId && lastEditorCollectionId) {
      // Check if the last collection still exists
      if (collections.has(lastEditorCollectionId)) {
        navigate(`/editor/${lastEditorCollectionId}`, { replace: true })
      }
    }
  }, [collectionId, lastEditorCollectionId, collections, isInitialized, navigate, isIntentNew])

  // Load collection data
  useEffect(() => {
    if (!isInitialized) return

    // Saving a new collection changes its URL, but the live draft may already
    // contain edits made while persistence was pending. Keep that session.
    if (collectionId && savedNewRoute.current === collectionId) {
      savedNewRoute.current = null
      setLastEditorCollectionId(collectionId)
      return
    }
    documentSession.current++
    setIsLoading(true)
    setDocumentAvailable(true)
    setSaveError(null)

    if (collectionId) {
      const doc = getCollectionDocument(collectionId)
      if (doc) {
        setDocument(doc)
        const json = formatJson(JSON.stringify(doc))
        latestJson.current = json
        setJsonContent(json)
        setOriginalJson(json)
        // Remember this collection for next time
        setLastEditorCollectionId(collectionId)
      } else {
        // Collection not found, redirect to new
        navigate('/editor', { replace: true, state: { intent: 'new' } })
      }
    } else {
      // New collection
      const defaultDoc = createDefaultDocument()
      setDocument(defaultDoc)
      const json = formatJson(JSON.stringify(defaultDoc))
      latestJson.current = json
      setJsonContent(json)
      setOriginalJson(json)
    }

    setIsLoading(false)
  }, [collectionId, isInitialized, getCollectionDocument, navigate, setLastEditorCollectionId, location.key])

  // Compute dirty state directly (not via useEffect) so it's immediately
  // accurate when state changes, avoiding race conditions with navigation blocker
  const isDirty = jsonContent !== originalJson

  // Block navigation when dirty
  const blocker = useBlocker(({ nextLocation }) => isDirty && !(savedNewRoute.current !== null && nextLocation.pathname === `/editor/${savedNewRoute.current}`))

  useEffect(() => {
    if (!isDirty) return
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [isDirty])

  // Sync to JSON
  const syncToJson = useCallback((doc: RandomTableDocument) => {
    setSaveError(null)
    const json = formatJson(JSON.stringify(doc))
    latestJson.current = json
    setJsonContent(json)
    setDocumentAvailable(true)
    setSaveSuccess(false)
  }, [])

  // Handle document changes from workspace
  const handleDocumentChange = useCallback((doc: RandomTableDocument) => {
    setDocument(doc)
  }, [])

  // Raw JSON remains authoritative even when it cannot produce a visual draft.
  const handleJsonChange = useCallback((value: string) => {
    setSaveError(null)
    latestJson.current = value
    setJsonContent(value)
    setSaveSuccess(false)
    try {
      const parsed = parseDraftSnapshot(value)
      setDocument(parsed)
      setDocumentAvailable(true)
    } catch {
      setDocumentAvailable(false)
    }
  }, [])

  // Save an immutable snapshot; a later edit never gets replaced by completion.
  const handleSave = useCallback(async () => {
    if (saveInProgress.current) return
    const session = documentSession.current
    const snapshotJson = latestJson.current
    let snapshot: RandomTableDocument
    try {
      snapshot = parseDraftSnapshot(snapshotJson)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Invalid document')
      return
    }
    if (!collectionId && snapshot.metadata.namespace.split('.').length < 2) {
      setSaveError('New collections need a namespace with at least two segments, such as my.tables')
      return
    }
    const id = collectionId || snapshot.metadata.namespace.replace(/\./g, '-')
    if (!collectionId && collections.has(id)) {
      setSaveError(`A collection with ID "${id}" already exists. Use a different namespace.`)
      return
    }
    saveInProgress.current = true
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await saveCollection(id, snapshot, 'user')
      if (!mounted.current || session !== documentSession.current) return
      if (!collectionId) savedNewRoute.current = id
      const completion = savedDraftState(latestJson.current, snapshotJson)
      flushSync(() => setOriginalJson(completion.originalJson))
      setSaveSuccess(!completion.isDirty)
      if (!collectionId) navigate(`/editor/${id}`, { replace: true })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      saveInProgress.current = false
      setIsSaving(false)
    }
  }, [collectionId, collections, saveCollection, navigate])

  const handleExport = useCallback(() => {
    try {
      const snapshot = parseDraftSnapshot(latestJson.current)
      if (!collectionId && snapshot.metadata.namespace.split('.').length < 2) {
        throw new Error('New collections need a namespace with at least two segments, such as my.tables')
      }
      setSaveError(null)
      if (snapshot.imports?.length) {
        setExportDocument(snapshot)
        setShowExportDialog(true)
      } else exportAsJson(snapshot)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Invalid document')
    }
  }, [collectionId])

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
    <>
      <SEO {...PAGE_SEO.editor} />
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
            onClick={handleExport}
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
        key={`${collectionId ?? 'new'}-${documentSession.current}`}
        document={document}
        documentAvailable={documentAvailable}
        jsonContent={jsonContent}
        onDocumentChange={handleDocumentChange}
        onJsonChange={handleJsonChange}
        syncToJson={syncToJson}
        collectionId={collectionId}
      />

      {/* Help Button */}
      <EditorHelpButton />

      {/* Unsaved Changes Dialog */}
      {blocker.state === 'blocked' && (
        <Modal onClose={() => blocker.reset?.()} aria-labelledby="unsaved-dialog-title" className="bg-background border rounded-2xl p-6 max-w-md w-full space-y-4 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <h2 id="unsaved-dialog-title" className="text-lg font-semibold">Unsaved Changes</h2>
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
        </Modal>
      )}

      {/* Export Dialog */}
      {showExportDialog && exportDocument && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          document={exportDocument}
          collectionId={collectionId}
        />
      )}
      </div>
    </>
  )
}

export default EditorPage
