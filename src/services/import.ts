/**
 * Import Service
 *
 * Handles importing JSON and ZIP files containing random table collections.
 * Validates documents against the spec and provides detailed error reporting.
 */

import JSZip from 'jszip'
import { validateDocument } from '../engine/core/validator'
import type { RandomTableDocument } from '../engine/types'
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
  document: RandomTableDocument
  /** Original filename */
  fileName: string
  /** Original path within ZIP (for import resolution) */
  originalPath?: string
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

// ============================================================================
// JSON Import
// ============================================================================

/**
 * Import a single JSON file.
 */
export async function importJsonFile(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    collections: [],
    errors: [],
    pathToIdMap: new Map(),
  }

  try {
    const content = await file.text()
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
export async function importZipFile(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    collections: [],
    errors: [],
    pathToIdMap: new Map(),
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

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

    // Process each JSON file
    for (const jsonPath of jsonFiles) {
      try {
        const content = await zip.files[jsonPath].async('string')
        const fileName = jsonPath.split('/').pop() || jsonPath
        const imported = parseAndValidateJson(content, fileName)

        if (imported.error) {
          result.errors.push({ fileName: jsonPath, error: imported.error })
        } else if (imported.collection) {
          // Store the original path for import resolution
          imported.collection.originalPath = jsonPath
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
        result.errors.push({
          fileName: jsonPath,
          error: error instanceof Error ? error.message : 'Failed to read file from ZIP',
        })
      }
    }

    result.success = result.collections.length > 0
  } catch (error) {
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
 * Parse and validate a JSON string as a RandomTableDocument.
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

  const doc = parsed as RandomTableDocument

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

  for (const file of files) {
    let result: ImportResult

    if (isZipFile(file)) {
      result = await importZipFile(file)
    } else if (isJsonFile(file)) {
      result = await importJsonFile(file)
    } else {
      combinedResult.errors.push({
        fileName: file.name,
        error: 'Unsupported file type. Please use .json or .zip files.',
      })
      continue
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
