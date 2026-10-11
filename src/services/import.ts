/**
 * Import Service
 *
 * Handles importing JSON and ZIP files containing random table collections.
 * Validates documents against the spec and provides detailed error reporting.
 */

import JSZip from 'jszip'
import { validateDocument } from '../engine/core/validator'
import type { AuthoredRandomTableDocument } from '../engine/types'
import { generateCollectionId } from './db'

// ============================================================================
// Types
// ============================================================================

export interface ImportedCollection {
  /** Generated ID for the collection */
  id: string
  /** Name from metadata */
  name: string
  /** The parsed and validated document */
  document: AuthoredRandomTableDocument
  /** Original filename */
  fileName: string
  /** Original path within ZIP (for import resolution) */
  originalPath?: string
  /** Identity of the file selection/archive this document came from. */
  bundleId?: string
}

export interface ImportError {
  /** Filename that caused the error */
  fileName: string
  /** Error message */
  error: string
}

export interface ImportResult {
  /** Whether at least one collection was successfully imported */
  success: boolean
  /** Successfully imported collections */
  collections: ImportedCollection[]
  /** Errors encountered during import */
  errors: ImportError[]
  /** Mapping from file paths to collection IDs (for import resolution) */
  pathToIdMap?: Map<string, string>
}

export interface ConflictInfo {
  /** The collection being imported */
  incoming: ImportedCollection
  /** The existing collection ID it conflicts with */
  existingId: string
  /** Name of the existing collection */
  existingName: string
}

/** Deliberate browser resource budgets, shared across a complete file selection. */
export const IMPORT_LIMITS = {
  documentBytes: 8 * 1024 * 1024,
  compressedBytes: 32 * 1024 * 1024,
  expandedBytes: 32 * 1024 * 1024,
  documents: 128,
  files: 128,
  archiveEntries: 1024,
} as const

interface ImportBudget { compressed: number; expanded: number; documents: number; exceeded: boolean }
function newBudget(): ImportBudget { return { compressed: 0, expanded: 0, documents: 0, exceeded: false } }
class ImportLimitError extends Error {}
function limit(budget: ImportBudget, message: string): never {
  budget.exceeded = true
  throw new ImportLimitError(`Import limit exceeded: ${message}`)
}
function reserveFile(file: File, budget: ImportBudget, maximum: number): void {
  if (file.size > maximum) limit(budget, `file exceeds ${maximum / 1024 / 1024} MiB`)
  if (budget.compressed + file.size > IMPORT_LIMITS.compressedBytes) limit(budget, 'selection exceeds 32 MiB of input')
}
function countDocument(budget: ImportBudget): void {
  if (++budget.documents > IMPORT_LIMITS.documents) limit(budget, 'selection exceeds 128 JSON documents')
}
function expandedChunk(budget: ImportBudget, documentBytes: number, chunkBytes: number): void {
  if (documentBytes + chunkBytes > IMPORT_LIMITS.documentBytes) limit(budget, 'JSON document exceeds 8 MiB')
  if (budget.expanded + chunkBytes > IMPORT_LIMITS.expandedBytes) limit(budget, 'selection expands beyond 32 MiB')
  budget.expanded += chunkBytes
}

/** Bound archive metadata before JSZip creates an object for every entry.
 * Walk the actual central headers as well as the advertised count; ZIP headers
 * are untrusted and can understate the entry count. Small ZIP64 archives with
 * ordinary fixed headers are supported within the same budgets.
 */
function checkArchiveDirectory(buffer: ArrayBuffer, budget: ImportBudget): void {
  const view = new DataView(buffer)
  let end = buffer.byteLength - 22
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--
  if (end < 0) throw new Error('Invalid ZIP: missing central directory')
  if (end + 22 + view.getUint16(end + 20, true) !== buffer.byteLength) throw new Error('Invalid ZIP: malformed directory trailer')
  let entries = view.getUint16(end + 10, true)
  let size = view.getUint32(end + 12, true)
  let directoryEnd = end
  if (entries === 0xffff || size === 0xffffffff || view.getUint32(end + 16, true) === 0xffffffff) {
    const locator = end - 20
    if (locator < 0 || view.getUint32(locator, true) !== 0x07064b50) throw new Error('Invalid ZIP64 directory')
    const recordOffset = Number(view.getBigUint64(locator + 8, true))
    if (!Number.isSafeInteger(recordOffset) || recordOffset < 0 || recordOffset + 56 > locator ||
      view.getUint32(recordOffset, true) !== 0x06064b50) throw new Error('Invalid ZIP64 directory offset')
    // JSZip does not safely handle extensible ZIP64 records; reject before parsing.
    if (view.getBigUint64(recordOffset + 4, true) !== 44n) throw new Error('ZIP64 extensible headers are unsupported; use a standard ZIP archive')
    entries = Number(view.getBigUint64(recordOffset + 32, true))
    size = Number(view.getBigUint64(recordOffset + 40, true))
    directoryEnd = recordOffset
  }
  if (entries > IMPORT_LIMITS.archiveEntries) limit(budget, 'archive exceeds 1024 entries')
  if (!Number.isSafeInteger(size) || size < 0 || size > directoryEnd) throw new Error('Invalid ZIP directory size')
  let offset = directoryEnd - size
  let actualEntries = 0
  while (offset + 4 <= directoryEnd && view.getUint32(offset, true) === 0x02014b50) {
    if (++actualEntries > IMPORT_LIMITS.archiveEntries) limit(budget, 'archive exceeds 1024 entries')
    if (offset + 46 > directoryEnd) throw new Error('Invalid ZIP directory entry')
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
    if (offset > directoryEnd) throw new Error('Invalid ZIP directory entry length')
  }
}

/** JSZip exposes this streaming API at runtime but omits it from its file typings.
 * Retain only bounded decoded chunks, pause upstream as soon as the actual byte
 * count exceeds the budget, and discard buffers on failure. Never accumulate an
 * unbounded inflated string or rely on the archive's declared expansion size.
 */
async function readZipDocument(entry: JSZip.JSZipObject, budget: ImportBudget): Promise<string> {
  const stream = (entry as JSZip.JSZipObject & {
    internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array>
  }).internalStream('uint8array')
  return new Promise((resolve, reject) => {
    let bytes = 0
    let stopped = false
    const decoder = new TextDecoder()
    const chunks: string[] = []
    stream.on('data', (chunk: Uint8Array) => {
      if (stopped) return
      try {
        expandedChunk(budget, bytes, chunk.byteLength)
        bytes += chunk.byteLength
        chunks.push(decoder.decode(chunk, { stream: true }))
      } catch (error) {
        stopped = true
        stream.pause()
        chunks.length = 0
        reject(error)
      }
    })
    stream.on('error', (error: Error) => {
      if (stopped) return
      stopped = true
      chunks.length = 0
      reject(error)
    })
    stream.on('end', () => {
      if (stopped) return
      stopped = true
      chunks.push(decoder.decode())
      resolve(chunks.join(''))
    })
    stream.resume()
  })
}

// ============================================================================
// JSON Import
// ============================================================================

/**
 * Import a single JSON file.
 */
export async function importJsonFile(file: File, budget: ImportBudget = newBudget()): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    collections: [],
    errors: [],
    pathToIdMap: new Map(),
  }

  try {
    reserveFile(file, budget, IMPORT_LIMITS.documentBytes)
    countDocument(budget)
    const bytes = await file.arrayBuffer()
    budget.compressed += bytes.byteLength
    if (budget.compressed > IMPORT_LIMITS.compressedBytes) limit(budget, 'selection exceeds 32 MiB of input')
    expandedChunk(budget, 0, bytes.byteLength)
    const content = new TextDecoder().decode(bytes)
    const imported = parseAndValidateJson(content, file.name)

    if (imported.error) {
      result.errors.push({ fileName: file.name, error: imported.error })
    } else if (imported.collection) {
      result.collections.push(imported.collection)
      result.success = true

      // Build path to ID mapping for import resolution
      // Store both the filename and ./prefixed version for flexible matching
      result.pathToIdMap!.set(file.name, imported.collection.id)
      result.pathToIdMap!.set(`./${file.name}`, imported.collection.id)
    }
  } catch (error) {
    result.errors.push({
      fileName: file.name,
      error: error instanceof Error ? error.message : 'Unknown error reading file',
    })
  }

  return result
}

// ============================================================================
// ZIP Import
// ============================================================================

/**
 * Import a ZIP file containing multiple JSON files.
 */
export async function importZipFile(file: File, budget: ImportBudget = newBudget()): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    collections: [],
    errors: [],
    pathToIdMap: new Map(),
  }

  try {
    reserveFile(file, budget, IMPORT_LIMITS.compressedBytes)
    const arrayBuffer = await file.arrayBuffer()
    budget.compressed += arrayBuffer.byteLength
    if (budget.compressed > IMPORT_LIMITS.compressedBytes) limit(budget, 'selection exceeds 32 MiB of input')
    checkArchiveDirectory(arrayBuffer, budget)
    const zip = await JSZip.loadAsync(arrayBuffer)
    if (Object.keys(zip.files).length > IMPORT_LIMITS.archiveEntries) limit(budget, 'archive exceeds 1024 entries')
    const bundleId = createBundleId()

    // Get all JSON files, excluding Mac OS metadata and hidden files
    const jsonFiles = Object.keys(zip.files).filter((name) => {
      // Must be a .json file
      if (!name.toLowerCase().endsWith('.json')) return false
      // Exclude Mac OS metadata
      if (name.startsWith('__MACOSX')) return false
      // Exclude hidden files (starting with .)
      if (name.split('/').some((segment) => segment.startsWith('.'))) return false
      // Exclude directories
      if (zip.files[name].dir) return false
      return true
    })

    if (jsonFiles.length === 0) {
      result.errors.push({
        fileName: file.name,
        error: 'No JSON files found in ZIP archive',
      })
      return result
    }

    if (budget.documents + jsonFiles.length > IMPORT_LIMITS.documents) limit(budget, 'selection exceeds 128 JSON documents')
    // Process each JSON file
    for (const jsonPath of jsonFiles) {
      try {
        countDocument(budget)
        const content = await readZipDocument(zip.files[jsonPath], budget)
        const fileName = jsonPath.split('/').pop() || jsonPath
        const imported = parseAndValidateJson(content, fileName)

        if (imported.error) {
          result.errors.push({ fileName: jsonPath, error: imported.error })
        } else if (imported.collection) {
          // Store the original path for import resolution
          imported.collection.originalPath = normalizeImportPath(jsonPath)
          imported.collection.bundleId = bundleId
          result.collections.push(imported.collection)

          // Build path to ID mapping for import resolution
          // Store both the full path and just the filename for flexible matching
          result.pathToIdMap!.set(jsonPath, imported.collection.id)
          result.pathToIdMap!.set(fileName, imported.collection.id)
          // Also store without ./ prefix for paths like "./monsters.json"
          if (!jsonPath.startsWith('./')) {
            result.pathToIdMap!.set(`./${jsonPath}`, imported.collection.id)
            result.pathToIdMap!.set(`./${fileName}`, imported.collection.id)
          }
        }
      } catch (error) {
        if (error instanceof ImportLimitError) throw error
        result.errors.push({
          fileName: jsonPath,
          error: error instanceof Error ? error.message : 'Failed to read file from ZIP',
        })
      }
    }

    result.success = result.collections.length > 0
  } catch (error) {
    if (error instanceof ImportLimitError) { result.collections = []; result.pathToIdMap!.clear() }
    result.errors.push({
      fileName: file.name,
      error: error instanceof Error ? error.message : 'Failed to read ZIP file',
    })
  }

  return result
}

// ============================================================================
// Validation
// ============================================================================

interface ParseResult {
  collection?: ImportedCollection
  error?: string
}

/**
 * Parse and validate a JSON string as a AuthoredRandomTableDocument.
 */
function parseAndValidateJson(content: string, fileName: string): ParseResult {
  // Parse JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return { error: 'Invalid JSON format' }
  }

  // Basic structure check
  if (!parsed || typeof parsed !== 'object') {
    return { error: 'Document must be a JSON object' }
  }

  const doc = parsed as AuthoredRandomTableDocument

  // Check required metadata
  if (!doc.metadata) {
    return { error: 'Missing required "metadata" field' }
  }

  if (!doc.metadata.name || typeof doc.metadata.name !== 'string') {
    return { error: 'Missing or invalid "metadata.name"' }
  }

  if (!doc.metadata.namespace || typeof doc.metadata.namespace !== 'string') {
    return { error: 'Missing or invalid "metadata.namespace"' }
  }

  if (!doc.metadata.version || typeof doc.metadata.version !== 'string') {
    return { error: 'Missing or invalid "metadata.version"' }
  }

  if (!doc.metadata.specVersion) {
    return { error: 'Missing "metadata.specVersion"' }
  }

  // Check tables exist
  if (!doc.tables || !Array.isArray(doc.tables)) {
    return { error: 'Missing or invalid "tables" array' }
  }

  // Run full validation
  const validation = validateDocument(doc)
  if (!validation.valid) {
    const firstError = validation.errors[0]
    return {
      error: firstError?.message || 'Document validation failed',
    }
  }

  // Generate ID
  const id = generateCollectionId(doc.metadata.namespace, doc.metadata.name, doc.metadata.version)

  return {
    collection: {
      id,
      name: doc.metadata.name,
      document: doc,
      fileName,
    },
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a file is a JSON file.
 */
export function isJsonFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.json') || file.type === 'application/json'
  )
}

/**
 * Check if a file is a ZIP file.
 */
export function isZipFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  )
}

/**
 * Check if a file is supported for import.
 */
export function isSupportedFile(file: File): boolean {
  return isJsonFile(file) || isZipFile(file)
}

/**
 * Import files (auto-detects JSON vs ZIP).
 */
export async function importFiles(files: File[]): Promise<ImportResult> {
  const combinedResult: ImportResult = {
    success: false,
    collections: [],
    errors: [],
    pathToIdMap: new Map(),
  }

  const budget = newBudget()
  if (files.length > IMPORT_LIMITS.files) {
    combinedResult.errors.push({ fileName: 'Selection', error: 'Import limit exceeded: select at most 128 files' })
    return combinedResult
  }
  for (const file of files) {
    let result: ImportResult

    if (isZipFile(file)) {
      result = await importZipFile(file, budget)
    } else if (isJsonFile(file)) {
      result = await importJsonFile(file, budget)
    } else {
      combinedResult.errors.push({
        fileName: file.name,
        error: 'Unsupported file type. Please use .json or .zip files.',
      })
      continue
    }

    if (budget.exceeded) {
      combinedResult.collections = []
      combinedResult.pathToIdMap!.clear()
      combinedResult.errors.push(...result.errors)
      return combinedResult
    }
    combinedResult.collections.push(...result.collections)
    combinedResult.errors.push(...result.errors)

    // Merge pathToIdMap entries
    if (result.pathToIdMap) {
      for (const [path, id] of result.pathToIdMap) {
        combinedResult.pathToIdMap!.set(path, id)
      }
    }
  }

  const looseBundleId = createBundleId()
  for (const collection of combinedResult.collections) {
    collection.bundleId ??= looseBundleId
    collection.originalPath ??= collection.fileName
  }
  combinedResult.success = combinedResult.collections.length > 0
  return combinedResult
}

/**
 * Generate a unique ID by adding a suffix if the base ID already exists.
 */
export function generateUniqueId(baseId: string, existingIds: Set<string>): string {
  if (!existingIds.has(baseId)) {
    return baseId
  }

  let counter = 2
  let newId = `${baseId}-${counter}`
  while (existingIds.has(newId)) {
    counter++
    newId = `${baseId}-${counter}`
  }

  return newId
}

/** Resolve archive paths without ever allowing a path to escape its bundle. */
export function normalizeImportPath(path: string, sourcePath = ''): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('/')) return undefined
  const segments = sourcePath.split('/').slice(0, -1)
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (!segments.length) return undefined
      segments.pop()
    } else segments.push(segment)
  }
  return segments.join('/')
}

function createBundleId(): string {
  return crypto.randomUUID()
}

/** Reserve identities across the complete batch, including documents with identical metadata. */
export function allocateImportBatch(
  incoming: ImportedCollection[],
  existingIds: Set<string>
): { collections: ImportedCollection[]; pathToIdMap: Map<string, string> } {
  const reserved = new Set(existingIds)
  const bundleId = createBundleId()
  const collections = incoming.map((collection) => {
    const id = generateUniqueId(collection.id, reserved)
    reserved.add(id)
    return { ...collection, id, bundleId: collection.bundleId ?? bundleId,
      originalPath: collection.originalPath ?? collection.fileName }
  })
  // The legacy global map may contain only unambiguous paths. Scoped origins are
  // authoritative and are resolved by the store instead of this compatibility map.
  const candidates = new Map<string, string[]>()
  for (const collection of collections) {
    for (const path of new Set([collection.originalPath, collection.fileName])) {
      if (!path) continue
      const normalized = normalizeImportPath(path)
      if (normalized) candidates.set(normalized, [...(candidates.get(normalized) ?? []), collection.id])
    }
  }
  const pathToIdMap = new Map<string, string>()
  for (const [path, ids] of candidates) {
    if (ids.length === 1) {
      pathToIdMap.set(path, ids[0])
      pathToIdMap.set(`./${path}`, ids[0])
    }
  }
  return { collections, pathToIdMap }
}
