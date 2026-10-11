/** Visualization uses the same resolved tables and weighted pools as rolling. */
import { useMemo } from 'react'
import { useCollectionStore } from '@/stores/collectionStore'
import type { RandomTableEngine } from '@/engine/core'
import type { Table } from '@/engine/types'
import { getTableIdentity } from '@/engine/core/context'
import { buildWeightedPool } from '@/engine/tables/simple'
import { buildSourcePool } from '@/engine/tables/composite'
import { mergeTableEntries, type CollectionSourceTable } from '@/engine/tables/collection'
import { getFiniteWeightTotal, getNormalizedProbabilities } from '@/engine/tables/weights'

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
export type TableVisualization = SimpleTableVisualization | CompositeTableVisualization | CollectionTableVisualization | null

function entryCount(table: Table): number {
  if (table.type === 'simple') return buildWeightedPool(table.entries, table.id).length
  if (table.type === 'composite') return buildSourcePool(table.sources).length
  return table.collections.length
}
function stats(weights: number[], types: string[] = []): TableStats {
  const totalWeight = getFiniteWeightTotal(weights.map(weight => ({ weight })))
  // Scaling avoids overflow in the mean for very large finite weights.
  const maxWeight = weights.reduce((max, weight) => Math.max(max, weight), 0)
  return { entryCount: weights.length, totalWeight,
    avgWeight: weights.length && maxWeight ? (weights.reduce((sum, weight) => sum + weight / maxWeight, 0) / weights.length) * maxWeight : 0,
    minWeight: weights.length ? weights.reduce((min, weight) => Math.min(min, weight), Infinity) : 0,
    maxWeight, uniqueResultTypes: [...new Set(types)] }
}
function inheritanceChain(engine: RandomTableEngine, tableId: string, collectionId: string): InheritanceNode[] {
  const chain: InheritanceNode[] = []
  const seen = new Set<string>()
  let resolved = engine.resolveTableReference(tableId, collectionId)
  while (resolved) {
    const { table, collectionId: owner } = resolved
    const key = `${owner}:${table.id}`
    if (seen.has(key)) break
    seen.add(key)
    chain.push({ tableId: table.id, tableName: table.name, entryCount: entryCount(engine.getResolvedTable(table.id, owner)!), level: chain.length })
    resolved = table.extends ? engine.resolveTableReference(table.extends, owner) : undefined
  }
  return chain
}

/** Pure computation exported for deterministic probability regression tests. */
export function computeTableVisualization(engine: RandomTableEngine, collectionId: string, tableId: string, maxEntries = 20): TableVisualization {
  const table = engine.getResolvedTable(tableId, collectionId)
  if (!table) return null
  const inheritance = inheritanceChain(engine, tableId, collectionId)
  const owner = engine.getResolvedCollectionId(tableId, collectionId) ?? collectionId
  if (table.type === 'simple') {
    const pool = buildWeightedPool(table.entries, table.id)
    const probabilities = getNormalizedProbabilities(pool)
    const entries = pool.map((weighted, index) => ({ id: weighted.id,
      label: weighted.entry.value.replace(/\{\{[^}]+\}\}/g, '[...]').trim().slice(0, 50),
      weight: weighted.weight, probability: probabilities[index] * 100, description: weighted.entry.description,
    })).sort((a, b) => b.weight - a.weight)
    const limit = Math.max(0, Math.floor(maxEntries))
    return { type: 'simple', entries: entries.slice(0, limit), truncated: entries.length > limit, totalEntries: pool.length,
      stats: stats(pool.map(item => item.weight), pool.map(item => item.entry.resultType ?? table.resultType).filter((type): type is string => !!type)), inheritance }
  }
  if (table.type === 'composite') {
    const pool = buildSourcePool(table.sources)
    const probabilities = getNormalizedProbabilities(pool)
    const sources = pool.map(({ source, weight }, index) => {
      const definition = engine.getResolvedTable(source.tableId, owner)
      return { tableId: source.tableId, tableName: definition?.name ?? `${source.tableId} (unavailable)`, weight,
        probability: probabilities[index] * 100, entryCount: definition ? entryCount(definition) : 0 }
    }).sort((a, b) => b.weight - a.weight)
    return { type: 'composite', sources, stats: stats(pool.map(item => item.weight)), inheritance }
  }
  // Only simple sources participate in collection rolling; inheritance resolves first.
  const sourceTables: CollectionSourceTable[] = []
  for (const id of table.collections) {
    const definition = engine.getResolvedTable(id, owner)
    if (definition?.type === 'simple') sourceTables.push({ id, table: definition, identity: getTableIdentity(engine.getResolvedCollectionId(id, owner) ?? owner, definition.id) })
  }
  const pool = mergeTableEntries(sourceTables)
  const probabilities = getNormalizedProbabilities(pool.entries)
  const sources = sourceTables.filter((source, index) => sourceTables.findIndex(other => other.identity === source.identity) === index).map(({ id, table: sourceTable }) => ({ tableId: id, tableName: sourceTable.name,
    entryCount: pool.entries.filter(entry => entry.sourceTableId === id).length,
    contributionPercent: pool.entries.reduce((sum, entry, index) => sum + (entry.sourceTableId === id ? probabilities[index] * 100 : 0), 0),
  })).sort((a, b) => b.contributionPercent - a.contributionPercent)
  return { type: 'collection', sources, totalEntries: pool.entries.length,
    stats: stats(pool.entries.map(entry => entry.weight), pool.entries.map(entry => entry.entry.resultType).filter((type): type is string => !!type)), inheritance }
}

interface UseTableVisualizationOptions { collectionId: string; tableId: string; maxEntries?: number }
export function useTableVisualization({ collectionId, tableId, maxEntries = 20 }: UseTableVisualizationOptions): TableVisualization {
  const collections = useCollectionStore(state => state.collections)
  const engine = useCollectionStore(state => state.engine)
  return useMemo(() => {
    if (!collections.has(collectionId)) return null
    try { return computeTableVisualization(engine, collectionId, tableId, maxEntries) }
    catch { return null } // Invalid inheritance is reported by document validation/rolling.
  }, [collections, engine, collectionId, tableId, maxEntries])
}
export default useTableVisualization
