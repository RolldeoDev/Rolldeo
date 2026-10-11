/**
 * WeightDistributionChart Component
 *
 * Horizontal bar chart showing weight distribution of table entries.
 * Uses pure CSS for rendering (no external charting library).
 */

import { memo } from 'react'
import type { WeightedEntry, SourceDistribution, CollectionSource } from '@/hooks/useTableVisualization'

// ============================================================================
// Simple Table Entry Chart
// ============================================================================

interface WeightedEntryChartProps {
  entries: WeightedEntry[]
  truncated: boolean
  totalEntries: number
  maxEntries?: number
}

export const WeightedEntryChart = memo(function WeightedEntryChart({
  entries,
  truncated,
  totalEntries,
}: WeightedEntryChartProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No entries to display
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.id} className="group">
          <div className="flex items-center gap-3">
            {/* Label */}
            <span
              className="w-32 md:w-48 text-xs truncate text-foreground/80 group-hover:text-foreground transition-colors"
              title={entry.label}
            >
              {entry.label}
            </span>

            {/* Bar container */}
            <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-mint/80 to-mint rounded-full transition-all duration-300 group-hover:from-mint group-hover:to-mint/90"
                style={{ width: `${Math.max(entry.probability, 1)}%` }}
              />
            </div>

            {/* Probability label */}
            <span className="w-14 text-xs text-right text-muted-foreground tabular-nums">
              {entry.probability.toFixed(1)}%
            </span>

            {/* Weight badge */}
            <span className="w-10 text-xs text-right text-muted-foreground/60 tabular-nums">
              w:{entry.weight}
            </span>
          </div>
        </div>
      ))}

      {truncated && (
        <div className="pt-2 text-center text-xs text-muted-foreground border-t border-border/50 mt-3">
          Showing top {entries.length} of {totalEntries} entries
        </div>
      )}
    </div>
  )
})

// ============================================================================
// Composite Table Source Chart
// ============================================================================

interface SourceDistributionChartProps {
  sources: SourceDistribution[]
}

export const SourceDistributionChart = memo(function SourceDistributionChart({
  sources,
}: SourceDistributionChartProps) {
  if (sources.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No sources defined
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sources.map((source) => (
        <div key={source.tableId} className="group">
          <div className="flex items-center gap-3">
            {/* Table name */}
            <span
              className="w-32 md:w-48 text-xs truncate text-foreground/80 group-hover:text-foreground transition-colors"
              title={source.tableName}
            >
              {source.tableName}
            </span>

            {/* Bar container */}
            <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan/80 to-cyan rounded-full transition-all duration-300 group-hover:from-cyan group-hover:to-cyan/90"
                style={{ width: `${Math.max(source.probability, 1)}%` }}
              />
            </div>

            {/* Probability label */}
            <span className="w-14 text-xs text-right text-muted-foreground tabular-nums">
              {source.probability.toFixed(1)}%
            </span>

            {/* Entry count badge */}
            <span className="w-12 text-xs text-right text-muted-foreground/60 tabular-nums">
              {source.entryCount}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
})

// ============================================================================
// Collection Table Source Chart
// ============================================================================

interface CollectionSourceChartProps {
  sources: CollectionSource[]
  totalEntries: number
}

export const CollectionSourceChart = memo(function CollectionSourceChart({
  sources,
  totalEntries,
}: CollectionSourceChartProps) {
  if (sources.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No tables in collection
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sources.map((source) => (
        <div key={source.tableId} className="group">
          <div className="flex items-center gap-3">
            {/* Table name */}
            <span
              className="w-32 md:w-48 text-xs truncate text-foreground/80 group-hover:text-foreground transition-colors"
              title={source.tableName}
            >
              {source.tableName}
            </span>

            {/* Bar container */}
            <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-lavender/80 to-lavender rounded-full transition-all duration-300 group-hover:from-lavender group-hover:to-lavender/90"
                style={{ width: `${Math.max(source.contributionPercent, 1)}%` }}
              />
            </div>

            {/* Percentage label */}
            <span className="w-14 text-xs text-right text-muted-foreground tabular-nums">
              {source.contributionPercent.toFixed(1)}%
            </span>

            {/* Entry count */}
            <span className="w-12 text-xs text-right text-muted-foreground/60 tabular-nums">
              {source.entryCount}
            </span>
          </div>
        </div>
      ))}

      <div className="pt-2 text-center text-xs text-muted-foreground border-t border-border/50 mt-3">
        Total: {totalEntries} entries from {sources.length} tables
      </div>
    </div>
  )
})

export default WeightedEntryChart
