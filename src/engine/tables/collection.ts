/**
 * Collection Table Handler
 *
 * A collection table merges all entries from multiple source tables
 * into a single unified pool for rolling.
 */

import type { CollectionTable, SimpleTable } from '../types'
import type { GenerationContext } from '../core/context'
import { buildWeightedPool, type WeightedEntry, type SelectedEntry } from './simple'
import { getUsedEntries, markEntryUsed } from '../core/context'
import { assertWeightedRanges, getFiniteWeightTotal, getNormalizedProbabilities, selectWeighted } from './weights'

// ============================================================================
// Types
// ============================================================================

export interface CollectionSourceTable {
  id: string
  table: SimpleTable
  /** Actual resolved collection/table identity; aliases to one source share this key. */
  identity?: string
}

export interface CollectionEntry extends WeightedEntry {
  /** Original table ID this entry came from */
  sourceTableId: string
}

export interface MergedPool {
  entries: CollectionEntry[]
  /** Finite display total saturated at Number.MAX_VALUE; not a probability denominator. */
  totalWeight: number
}

// ============================================================================
// Pool Merging
// ============================================================================

/**
 * Merge entries from multiple simple tables into a unified pool.
 * Entry IDs are prefixed with source table ID to avoid collisions.
 */
export function mergeTableEntries(
  tables: CollectionSourceTable[],
  excludeIds?: Set<string>
): MergedPool {
  const entries: CollectionEntry[] = []

  const seenSources = new Set<string>()
  for (const { id: sourceTableId, table, identity } of tables) {
    if (table.selection) {
      throw new Error(`DICE_SELECTION_ERROR: Native dice table '${sourceTableId}' cannot be pooled into a collection; use a composite source instead`)
    }
    assertWeightedRanges(table.entries, sourceTableId)
    if (identity && seenSources.has(identity)) continue
    if (identity) seenSources.add(identity)
    // Build weighted pool for this table
    const pool = buildWeightedPool(table.entries, sourceTableId)

    for (const weighted of pool) {
      // Create prefixed ID to avoid collision
      const prefixedId = identity ? JSON.stringify([identity, weighted.id]) : `${sourceTableId}.${weighted.id}`

      // Skip if excluded
      if (excludeIds?.has(prefixedId)) continue

      entries.push({
        ...weighted,
        id: prefixedId,
        sourceTableId,
      })
    }
  }

  const totalWeight = getFiniteWeightTotal(entries)

  return { entries, totalWeight }
}

// ============================================================================
// Selection
// ============================================================================

/**
 * Select a random entry from a merged collection pool
 */
export function selectFromPool(pool: MergedPool, random?: () => number): CollectionEntry | null {
  return selectWeighted(pool.entries, random)
}

// ============================================================================
// Collection Rolling
// ============================================================================

export interface CollectionRollOptions {
  /** Force unique selection */
  unique?: boolean
  /** Qualified collection/table identity supplied by the engine. */
  trackingKey?: string
  /** Additional entry IDs to exclude */
  excludeIds?: Set<string>
}

export interface CollectionSelectedEntry extends SelectedEntry {
  /** The source table this entry came from */
  sourceTableId: string
}

/**
 * Roll on a collection table.
 *
 * @param table The collection table definition
 * @param getTables Function to resolve table IDs to SimpleTable instances
 * @param context Generation context
 * @param options Roll options
 */
export function rollCollectionTable(
  table: CollectionTable,
  getTables: (ids: string[]) => CollectionSourceTable[],
  context: GenerationContext,
  options: CollectionRollOptions = {}
): CollectionSelectedEntry | null {
  const trackingKey = options.trackingKey ?? table.id
  // Resolve source tables
  const sourceTables = getTables(table.collections)

  if (sourceTables.length === 0) {
    return null
  }

  // Build exclude set
  const excludeIds = new Set<string>()

  if (options.excludeIds) {
    for (const id of options.excludeIds) {
      excludeIds.add(id)
    }
  }

  if (options.unique) {
    const used = getUsedEntries(context, trackingKey)
    for (const id of used) {
      excludeIds.add(id)
    }
  }

  // Merge all entries
  let pool = mergeTableEntries(sourceTables, excludeIds)

  // Handle unique overflow
  if (pool.entries.length === 0) {
    const available = mergeTableEntries(sourceTables, options.excludeIds)
    if (available.entries.length === 0 || !options.unique) return null
    const behavior = context.config.uniqueOverflowBehavior

    if (behavior === 'error') {
      throw new Error(
        `Unique selection overflow: no more entries available in collection '${table.id}'`
      )
    }

    if (behavior === 'cycle') {
      context.usedEntries.delete(trackingKey)
      pool = available
      excludeIds.clear()
      for (const id of options.excludeIds ?? []) excludeIds.add(id)
    } else {
      return null
    }
  }

  // Select entry
  const selected = selectFromPool(pool, context.random)
  if (!selected) return null

  // Mark as used if unique selection
  if (options.unique) {
    markEntryUsed(context, trackingKey, selected.id)
  }

  // Find the source table for defaultSets
  const sourceTable = sourceTables.find((t) => t.id === selected.sourceTableId)

  // Merge sets: sourceTable.defaultSets → collection.defaultSets → entry.sets, and include entry value
  const mergedSets = {
    ...(sourceTable?.table.defaultSets ?? {}),
    ...(table.defaultSets ?? {}),
    ...(selected.entry.sets ?? {}),
    // Include the entry's value so @tableName.value works
    value: selected.entry.value,
  }

  // Determine resultType: entry → source table → collection table
  const resultType =
    selected.entry.resultType ??
    sourceTable?.table.resultType ??
    table.resultType

  return {
    entry: selected.entry,
    id: selected.id,
    mergedSets,
    assets: selected.entry.assets,
    resultType,
    sourceTableId: selected.sourceTableId,
    selectionPool: pool.entries,
    excludedIds: excludeIds,
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get probability statistics for a collection table
 */
export interface CollectionEntryProbability {
  id: string
  sourceTableId: string
  value: string
  weight: number
  probability: number
  percentage: string
}

export function getCollectionProbabilities(
  table: CollectionTable,
  getTables: (ids: string[]) => CollectionSourceTable[]
): CollectionEntryProbability[] {
  const sourceTables = getTables(table.collections)
  const pool = mergeTableEntries(sourceTables)

  const probabilities = getNormalizedProbabilities(pool.entries)

  return pool.entries.map((entry, index) => {
    const probability = probabilities[index]
    return {
      id: entry.id,
      sourceTableId: entry.sourceTableId,
      value: entry.entry.value,
      weight: entry.weight,
      probability,
      percentage: `${(probability * 100).toFixed(2)}%`,
    }
  })
}

/**
 * Validate a collection table
 */
export interface CollectionValidationIssue {
  type: 'error' | 'warning'
  message: string
  tableId?: string
}

export function validateCollectionTable(
  table: CollectionTable,
  tableExists: (id: string) => boolean,
  isSimple: (id: string) => boolean
): CollectionValidationIssue[] {
  const issues: CollectionValidationIssue[] = []

  if (table.collections.length === 0) {
    issues.push({
      type: 'error',
      message: 'Collection table has no source tables',
    })
    return issues
  }

  for (const tableId of table.collections) {
    if (!tableExists(tableId)) {
      issues.push({
        type: 'error',
        message: `Source table not found: ${tableId}`,
        tableId,
      })
    } else if (!isSimple(tableId)) {
      issues.push({
        type: 'error',
        message: `Source table must be a simple table: ${tableId}`,
        tableId,
      })
    }
  }

  return issues
}
