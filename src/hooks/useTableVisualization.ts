/**
 * useTableVisualization Hook
 *
 * Computes visualization data for tables including weight distributions,
 * inheritance chains, and statistics.
 */

import { useMemo } from 'react'
import { useCollectionStore } from '@/stores/collectionStore'
import type { Table, SimpleTable, CompositeTable, CollectionTable, Entry } from '@/engine/types'

// ============================================================================
// Types
// ============================================================================

export interface WeightedEntry {
  id: string
  label: string
  weight: number
  probability: number
  description?: string
}

export interface SourceDistribution {
  tableId: string
  tableName: string
  weight: number
  probability: number
  entryCount: number
}

export interface CollectionSource {
  tableId: string
  tableName: string
  entryCount: number
  contributionPercent: number
}

export interface InheritanceNode {
  tableId: string
  tableName: string
  entryCount: number
  level: number
}

export interface TableStats {
  entryCount: number
  totalWeight: number
  avgWeight: number
  minWeight: number
  maxWeight: number
  uniqueResultTypes: string[]
}

export interface SimpleTableVisualization {
  type: 'simple'
  entries: WeightedEntry[]
  truncated: boolean
  totalEntries: number
  stats: TableStats
  inheritance: InheritanceNode[]
}

export interface CompositeTableVisualization {
  type: 'composite'
  sources: SourceDistribution[]
  stats: TableStats
  inheritance: InheritanceNode[]
}

export interface CollectionTableVisualization {
  type: 'collection'
  sources: CollectionSource[]
  totalEntries: number
  stats: TableStats
  inheritance: InheritanceNode[]
}

export type TableVisualization =
  | SimpleTableVisualization
  | CompositeTableVisualization
  | CollectionTableVisualization
  | null

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get effective weight of an entry (default is 1)
 */
function getEntryWeight(entry: Entry): number {
  return entry.weight ?? 1
}

/**
 * Truncate and format entry value for display
 */
function formatEntryLabel(value: string, maxLength = 50): string {
  // Strip {{...}} expressions for cleaner display
  const stripped = value.replace(/\{\{[^}]+\}\}/g, '[...]').trim()
  if (stripped.length <= maxLength) return stripped
  return stripped.slice(0, maxLength - 3) + '...'
}

/**
 * Build inheritance chain by following `extends` property
 */
function buildInheritanceChain(
  table: Table,
  getTable: (tableId: string) => Table | undefined,
  maxDepth = 5
): InheritanceNode[] {
  const chain: InheritanceNode[] = []
  let current: Table | undefined = table
  let level = 0

  while (current && level < maxDepth) {
    chain.push({
      tableId: current.id,
      tableName: current.name,
      entryCount: getTableEntryCount(current),
      level,
    })

    if (current.extends) {
      current = getTable(current.extends)
      level++
    } else {
      break
    }
  }

  return chain
}

/**
 * Get entry count for any table type
 */
function getTableEntryCount(table: Table): number {
  switch (table.type) {
    case 'simple':
      return (table as SimpleTable).entries.length
    case 'composite':
      return (table as CompositeTable).sources.length
    case 'collection':
      return (table as CollectionTable).collections.length
    default:
      return 0
  }
}

/**
 * Compute stats for a simple table
 */
function computeSimpleTableStats(entries: Entry[]): TableStats {
  if (entries.length === 0) {
    return {
      entryCount: 0,
      totalWeight: 0,
      avgWeight: 0,
      minWeight: 0,
      maxWeight: 0,
      uniqueResultTypes: [],
    }
  }

  const weights = entries.map(getEntryWeight)
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  const resultTypes = new Set<string>()

  entries.forEach((entry) => {
    if (entry.resultType) {
      resultTypes.add(entry.resultType)
    }
  })

  return {
    entryCount: entries.length,
    totalWeight,
    avgWeight: totalWeight / entries.length,
    minWeight: Math.min(...weights),
    maxWeight: Math.max(...weights),
    uniqueResultTypes: Array.from(resultTypes),
  }
}

// ============================================================================
// Hook
// ============================================================================

interface UseTableVisualizationOptions {
  /** Maximum entries to include in visualization (default: 20) */
  maxEntries?: number
  /** Collection ID for the table */
  collectionId: string
  /** Table ID to visualize */
  tableId: string
}

export function useTableVisualization({
  collectionId,
  tableId,
  maxEntries = 20,
}: UseTableVisualizationOptions): TableVisualization {
  const getCollection = useCollectionStore((state) => state.getCollection)
  const engine = useCollectionStore((state) => state.engine)

  return useMemo(() => {
    const collection = getCollection(collectionId)
    if (!collection) return null

    // Get table from engine for proper resolution
    const table = engine?.getTable(collectionId, tableId)
    if (!table) return null

    // Helper to get table by ID (for inheritance chain)
    const getTable = (id: string) => engine?.getTable(collectionId, id)

    // Build inheritance chain
    const inheritance = buildInheritanceChain(table, getTable)

    switch (table.type) {
      case 'simple':
        return computeSimpleVisualization(table as SimpleTable, maxEntries, inheritance)
      case 'composite':
        return computeCompositeVisualization(table as CompositeTable, getTable, inheritance)
      case 'collection':
        return computeCollectionVisualization(table as CollectionTable, getTable, inheritance)
      default:
        return null
    }
  }, [collectionId, tableId, maxEntries, getCollection, engine])
}

/**
 * Compute visualization data for a simple table
 */
function computeSimpleVisualization(
  table: SimpleTable,
  maxEntries: number,
  inheritance: InheritanceNode[]
): SimpleTableVisualization {
  const entries = table.entries
  const stats = computeSimpleTableStats(entries)

  // Sort by weight descending and take top N
  const sortedEntries = [...entries]
    .map((entry, index) => ({
      entry,
      weight: getEntryWeight(entry),
      index,
    }))
    .sort((a, b) => b.weight - a.weight)

  const truncated = sortedEntries.length > maxEntries
  const displayEntries = sortedEntries.slice(0, maxEntries)

  const weightedEntries: WeightedEntry[] = displayEntries.map(({ entry, weight }, idx) => ({
    id: entry.id || `entry-${idx}`,
    label: formatEntryLabel(entry.value),
    weight,
    probability: stats.totalWeight > 0 ? (weight / stats.totalWeight) * 100 : 0,
    description: entry.description,
  }))

  return {
    type: 'simple',
    entries: weightedEntries,
    truncated,
    totalEntries: entries.length,
    stats,
    inheritance,
  }
}

/**
 * Compute visualization data for a composite table
 */
function computeCompositeVisualization(
  table: CompositeTable,
  getTable: (id: string) => Table | undefined,
  inheritance: InheritanceNode[]
): CompositeTableVisualization {
  const sources = table.sources
  const totalWeight = sources.reduce((sum, s) => sum + (s.weight ?? 1), 0)

  const sourceDistributions: SourceDistribution[] = sources.map((source) => {
    const sourceTable = getTable(source.tableId)
    const weight = source.weight ?? 1
    return {
      tableId: source.tableId,
      tableName: sourceTable?.name || source.tableId,
      weight,
      probability: totalWeight > 0 ? (weight / totalWeight) * 100 : 0,
      entryCount: sourceTable ? getTableEntryCount(sourceTable) : 0,
    }
  })

  // Sort by weight descending
  sourceDistributions.sort((a, b) => b.weight - a.weight)

  const stats: TableStats = {
    entryCount: sources.length,
    totalWeight,
    avgWeight: sources.length > 0 ? totalWeight / sources.length : 0,
    minWeight: sources.length > 0 ? Math.min(...sources.map((s) => s.weight ?? 1)) : 0,
    maxWeight: sources.length > 0 ? Math.max(...sources.map((s) => s.weight ?? 1)) : 0,
    uniqueResultTypes: [],
  }

  return {
    type: 'composite',
    sources: sourceDistributions,
    stats,
    inheritance,
  }
}

/**
 * Compute visualization data for a collection table
 */
function computeCollectionVisualization(
  table: CollectionTable,
  getTable: (id: string) => Table | undefined,
  inheritance: InheritanceNode[]
): CollectionTableVisualization {
  const collections = table.collections
  let totalEntries = 0

  const collectionSources: CollectionSource[] = collections.map((tableId) => {
    const sourceTable = getTable(tableId)
    const entryCount = sourceTable ? getTableEntryCount(sourceTable) : 0
    totalEntries += entryCount
    return {
      tableId,
      tableName: sourceTable?.name || tableId,
      entryCount,
      contributionPercent: 0, // Will be calculated after
    }
  })

  // Calculate contribution percentages
  collectionSources.forEach((source) => {
    source.contributionPercent = totalEntries > 0 ? (source.entryCount / totalEntries) * 100 : 0
  })

  // Sort by entry count descending
  collectionSources.sort((a, b) => b.entryCount - a.entryCount)

  const stats: TableStats = {
    entryCount: totalEntries,
    totalWeight: totalEntries, // Each entry has weight 1 in collection
    avgWeight: 1,
    minWeight: 1,
    maxWeight: 1,
    uniqueResultTypes: [],
  }

  return {
    type: 'collection',
    sources: collectionSources,
    totalEntries,
    stats,
    inheritance,
  }
}

export default useTableVisualization
