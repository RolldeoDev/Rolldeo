/**
 * Export Service
 *
 * Handles exporting collections as JSON files or ZIP archives.
 */

import type { RandomTableDocument } from '../engine/types'
import type { RandomTableEngine } from '../engine/core'
import type { CollectionMeta } from '../stores/collectionStore'
import JSZip from 'jszip'

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
  document: RandomTableDocument,
  filename?: string,
  options: ExportOptions = {}
): void {
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

/**
 * Export multiple collections as a ZIP file.
 * Each collection is saved as a separate JSON file.
 */
export async function exportAsZip(
  collections: Array<{ id: string; document: RandomTableDocument }>,
  zipFilename?: string,
  options: ExportOptions = {}
): Promise<void> {
  const { prettyPrint = true, indent = 2 } = options

  const zip = new JSZip()

  for (const { id, document } of collections) {
    const json = prettyPrint
      ? JSON.stringify(document, null, indent)
      : JSON.stringify(document)

    const filename = `${document.metadata.namespace || id}.json`
    zip.file(filename, json)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)

  const name = zipFilename || 'rolldeo-collections.zip'

  downloadFile(url, name)
  URL.revokeObjectURL(url)
}

/**
 * Get JSON string for a document (for copy to clipboard, etc.)
 */
export function documentToJson(
  document: RandomTableDocument,
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
  document: RandomTableDocument,
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
  /** The main collection being exported */
  primary: { id: string; document: RandomTableDocument }
  /** All resolved dependencies */
  dependencies: Array<{ id: string; document: RandomTableDocument }>
  /** Paths that could not be resolved */
  unresolvedPaths: string[]
}

/**
 * Resolve all dependencies for a document recursively.
 * Uses BFS to traverse imports and handles circular dependencies.
 */
export function resolveExportDependencies(
  document: RandomTableDocument,
  collectionId: string | undefined,
  engine: RandomTableEngine,
  collections: Map<string, CollectionMeta>
): ResolvedExport {
  const resolved = new Map<string, RandomTableDocument>()
  const unresolvedPaths: string[] = []
  const visited = new Set<string>()

  // Use BFS to traverse imports
  const queue: RandomTableDocument[] = [document]

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentNamespace = current.metadata.namespace

    // Skip if already visited (handles circular refs)
    if (visited.has(currentNamespace)) continue
    visited.add(currentNamespace)

    // Skip if no imports
    if (!current.imports || current.imports.length === 0) continue

    for (const imp of current.imports) {
      // Try to resolve the import path to a loaded collection
      const targetDoc = resolveImportPath(imp.path, engine, collections)

      if (targetDoc) {
        const targetNs = targetDoc.metadata.namespace
        if (!visited.has(targetNs) && !resolved.has(targetNs)) {
          resolved.set(targetNs, targetDoc)
          queue.push(targetDoc) // Process its imports too (recursive)
        }
      } else {
        unresolvedPaths.push(imp.path)
      }
    }
  }

  return {
    primary: {
      id: collectionId || document.metadata.namespace.replace(/\./g, '-'),
      document,
    },
    dependencies: Array.from(resolved.entries()).map(([ns, doc]) => ({
      id: ns.replace(/\./g, '-'),
      document: doc,
    })),
    unresolvedPaths: [...new Set(unresolvedPaths)], // Deduplicate
  }
}

/**
 * Resolve an import path to a document.
 */
function resolveImportPath(
  path: string,
  engine: RandomTableEngine,
  collections: Map<string, CollectionMeta>
): RandomTableDocument | undefined {
  // 1. Try matching by namespace (most common case)
  for (const [id, meta] of collections) {
    if (meta.namespace === path) {
      const loaded = engine.getCollection(id)
      return loaded?.document
    }
  }

  // 2. Try matching by collection ID (fallback)
  const loaded = engine.getCollection(path)
  if (loaded) return loaded.document

  return undefined
}
