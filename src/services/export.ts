/**
 * Export Service
 *
 * Handles exporting collections as JSON files or ZIP archives.
 */

import type { AuthoredRandomTableDocument } from '../engine/types'
import type { RandomTableEngine } from '../engine/core'
import type { CollectionMeta } from '../stores/collectionStore'
import JSZip from 'jszip'
import { validateDocument } from '../engine/core/validator'

export interface ExportOptions {
  /** Whether to pretty-print the JSON */
  prettyPrint?: boolean
  /** Indentation spaces (default: 2) */
  indent?: number
}

/**
 * Export a single collection as a JSON file.
 * Triggers a download in the browser.
 */
export function exportAsJson(
  document: AuthoredRandomTableDocument,
  filename?: string,
  options: ExportOptions = {}
): void {
  assertExportable(document)
  const { prettyPrint = true, indent = 2 } = options

  const json = prettyPrint
    ? JSON.stringify(document, null, indent)
    : JSON.stringify(document)

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const name = filename || `${document.metadata.namespace || 'collection'}.json`

  downloadFile(url, name)
  URL.revokeObjectURL(url)
}

/** Download a saved rejected record exactly as JSON for manual recovery. */
export function exportRawDocument(document: unknown, filename = 'rolldeo-recovery.json'): void {
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try { downloadFile(url, filename) }
  finally { URL.revokeObjectURL(url) }
}

/**
 * Export multiple collections as a ZIP file.
 * Each collection is saved as a separate JSON file.
 */
export interface ExportCollection {
  id: string
  document: AuthoredRandomTableDocument
  /** Exact resolved alias-to-collection identities; preserved during archive rewriting. */
  importTargets?: Record<string, string>
}

/** Construct a portable archive with unique filenames and rewritten bound dependencies. */
export function createCollectionArchive(collections: ExportCollection[], options: ExportOptions = {}): JSZip {
  const zip = new JSZip()
  const names = new Map<string, string>()
  const used = new Set<string>()
  for (const { id, document } of collections) {
    assertExportable(document)
    if (names.has(id)) throw new Error(`Duplicate export collection identity: ${id}`)
    const base = namespaceToFilename(document.metadata.namespace || id)
    let filename = `${base}.json`
    let suffix = 2
    while (used.has(filename)) filename = `${base}-${suffix++}.json`
    used.add(filename)
    names.set(id, filename)
  }
  for (const collection of collections) {
    const imports = collection.document.imports?.map((imp) => {
      let targetId = collection.importTargets?.[imp.alias]
      if (collection.importTargets === undefined) {
        const candidates = collections.filter((target) => target.id === imp.path || target.document.metadata.namespace === imp.path)
        if (candidates.length === 1) targetId = candidates[0].id
      }
      const filename = targetId ? names.get(targetId) : undefined
      if (filename) return { ...imp, path: `./${filename}` }
      // Exact bindings supplied by callers are authoritative. Missing or omitted
      // dependencies must never accidentally bind to another exported version.
      if (collection.importTargets !== undefined) return { ...imp,
        path: `./rolldeo-missing-imports/${namespaceToFilename(collection.id)}-${namespaceToFilename(imp.alias)}.json` }
      return { ...imp }
    })
    const document = imports ? { ...collection.document, imports } : collection.document
    zip.file(names.get(collection.id)!, documentToJson(document, options))
  }
  return zip
}

function assertExportable(document: AuthoredRandomTableDocument): void {
  const validation = validateDocument(document)
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join('; '))
}

export async function exportAsZip(
  collections: ExportCollection[],
  zipFilename?: string,
  options: ExportOptions = {}
): Promise<void> {
  const zip = createCollectionArchive(collections, options)
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  try { downloadFile(url, zipFilename || 'rolldeo-collections.zip') }
  finally { URL.revokeObjectURL(url) }
}

/**
 * Get JSON string for a document (for copy to clipboard, etc.)
 */
export function documentToJson(
  document: AuthoredRandomTableDocument,
  options: ExportOptions = {}
): string {
  const { prettyPrint = true, indent = 2 } = options

  return prettyPrint
    ? JSON.stringify(document, null, indent)
    : JSON.stringify(document)
}

/**
 * Copy document JSON to clipboard.
 */
export async function copyToClipboard(
  document: AuthoredRandomTableDocument,
  options: ExportOptions = {}
): Promise<boolean> {
  try {
    const json = documentToJson(document, options)
    await navigator.clipboard.writeText(json)
    return true
  } catch {
    return false
  }
}

/**
 * Trigger a file download in the browser.
 */
function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Generate a safe filename from a namespace.
 */
export function namespaceToFilename(namespace: string): string {
  return namespace
    .toLowerCase()
    .replace(/\./g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'collection'
}

// ============================================================================
// Dependency Resolution
// ============================================================================

export interface ResolvedExport {
  primary: ExportCollection
  dependencies: ExportCollection[]
  unresolvedPaths: string[]
}

/** Traverse the runtime's actual bindings, keyed by identity rather than namespace. */
export function resolveExportDependencies(
  document: AuthoredRandomTableDocument,
  collectionId: string | undefined,
  engine: RandomTableEngine,
  _collections: Map<string, CollectionMeta>
): ResolvedExport {
  void _collections // Retained parameter for existing export callers; runtime bindings are authoritative.
  const primaryId = collectionId || document.metadata.namespace
  const primary: ExportCollection = { id: primaryId, document, importTargets: {} }
  const resolved = new Map<string, ExportCollection>([[primaryId, primary]])
  const queue = [primary]
  const unresolvedPaths: string[] = []
  while (queue.length) {
    const current = queue.shift()!
    const loaded = engine.getCollection(current.id)
    for (const imp of current.document.imports ?? []) {
      // A changed draft import must not inherit a saved alias binding for a different path.
      const unchangedPath = loaded?.document.imports?.some((saved) => saved.alias === imp.alias && saved.path === imp.path)
      const target = unchangedPath ? loaded?.imports.get(imp.alias) : undefined
      if (!target) {
        unresolvedPaths.push(`${current.id}: ${imp.path}`)
        continue
      }
      current.importTargets![imp.alias] = target.id
      if (!resolved.has(target.id)) {
        const dependency: ExportCollection = { id: target.id, document: target.document, importTargets: {} }
        resolved.set(target.id, dependency)
        queue.push(dependency)
      }
    }
  }
  return { primary, dependencies: [...resolved.values()].filter((item) => item.id !== primaryId),
    unresolvedPaths: [...new Set(unresolvedPaths)] }
}
