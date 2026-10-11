/**
 * Composite Table Handler
 *
 * A composite table selects which source table to roll on using weighted probability,
 * then rolls once on that selected table.
 */

import type { CompositeTable, CompositeSource } from '../types'
import { getWeight, getFiniteWeightTotal, getNormalizedProbabilities, selectWeighted } from './weights'

// ============================================================================
// Types
// ============================================================================

export interface WeightedSource {
  source: CompositeSource
  weight: number
}

export interface CompositeSelection {
  /** The selected source table ID */
  sourceTableId: string
  /** The weight of the selected source */
  weight: number
}

// ============================================================================
// Source Selection
// ============================================================================

/**
 * Build a weighted pool of source tables
 */
export function buildSourcePool(sources: CompositeSource[]): WeightedSource[] {
  return sources
    .map((source) => ({
      source,
      weight: getWeight(source),
    }))
    .filter((ws) => ws.weight > 0)
}

/**
 * Calculate a finite display total, saturated at Number.MAX_VALUE.
 * Use getNormalizedProbabilities for probability calculations.
 */
export function calculateSourceWeight(pool: WeightedSource[]): number {
  return getFiniteWeightTotal(pool)
}

/**
 * Select a source table from the composite table
 */
export function selectSource(table: CompositeTable, random?: () => number): CompositeSelection | null {
  const pool = buildSourcePool(table.sources)
  const selected = selectWeighted(pool, random)
  if (!selected) return null
  return {
    sourceTableId: selected.source.tableId,
    weight: selected.weight,
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get probability statistics for source tables
 */
export interface SourceProbability {
  tableId: string
  weight: number
  probability: number
  percentage: string
}

export function getSourceProbabilities(table: CompositeTable): SourceProbability[] {
  const pool = buildSourcePool(table.sources)
  const probabilities = getNormalizedProbabilities(pool)

  return pool.map((ws, index) => {
    const probability = probabilities[index]
    return {
      tableId: ws.source.tableId,
      weight: ws.weight,
      probability,
      percentage: `${(probability * 100).toFixed(2)}%`,
    }
  })
}

/**
 * Get all source table IDs referenced by a composite table
 */
export function getSourceTableIds(table: CompositeTable): string[] {
  return table.sources.map((s) => s.tableId)
}

/**
 * Validate a composite table
 */
export interface CompositeValidationIssue {
  type: 'error' | 'warning'
  message: string
  sourceIndex?: number
}

export function validateCompositeTable(
  table: CompositeTable,
  tableExists: (id: string) => boolean
): CompositeValidationIssue[] {
  const issues: CompositeValidationIssue[] = []

  if (table.sources.length === 0) {
    issues.push({
      type: 'error',
      message: 'Composite table has no sources',
    })
    return issues
  }

  for (let i = 0; i < table.sources.length; i++) {
    const source = table.sources[i]

    // Check weight
    if (source.weight !== undefined && (!Number.isFinite(source.weight) || source.weight < 0)) {
      issues.push({
        type: 'error',
        message: `Source has invalid weight: ${source.weight}; must be finite and nonnegative`,
        sourceIndex: i,
      })
    }

    if (source.weight === 0) {
      issues.push({
        type: 'warning',
        message: `Source '${source.tableId}' has weight 0 (disabled)`,
        sourceIndex: i,
      })
    }

    // Check if source table exists
    if (!tableExists(source.tableId)) {
      issues.push({
        type: 'error',
        message: `Source table not found: ${source.tableId}`,
        sourceIndex: i,
      })
    }
  }

  // Check if all sources are disabled
  const pool = buildSourcePool(table.sources)
  if (pool.length === 0) {
    issues.push({
      type: 'error',
      message: 'All sources have zero weight - table cannot be rolled',
    })
  }

  return issues
}
