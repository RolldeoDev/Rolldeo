/**
 * Export Service
 *
 * Handles exporting collections as JSON files or ZIP archives.
 */

import type { RandomTableDocument } from '../engine/types'
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
