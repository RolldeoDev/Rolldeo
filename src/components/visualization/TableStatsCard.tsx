/**
 * TableStatsCard Component
 *
 * Displays summary statistics for a table's weight distribution.
 */

import { memo } from 'react'
import { Hash, Scale, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import type { TableStats } from '@/hooks/useTableVisualization'

interface TableStatsCardProps {
  stats: TableStats
  tableType: 'simple' | 'composite' | 'collection'
}

export const TableStatsCard = memo(function TableStatsCard({
  stats,
  tableType,
}: TableStatsCardProps) {
  const statItems = [
    {
      icon: Hash,
      label: tableType === 'simple' ? 'Entries' : tableType === 'composite' ? 'Sources' : 'Tables',
      value: stats.entryCount.toString(),
      color: 'text-mint',
    },
    {
      icon: Scale,
      label: 'Total Weight',
      value: stats.totalWeight.toFixed(0),
      color: 'text-cyan',
    },
    {
      icon: BarChart3,
      label: 'Avg Weight',
      value: stats.avgWeight.toFixed(1),
      color: 'text-foreground',
    },
    {
      icon: TrendingDown,
      label: 'Min Weight',
      value: stats.minWeight.toFixed(0),
      color: 'text-amber',
    },
    {
      icon: TrendingUp,
      label: 'Max Weight',
      value: stats.maxWeight.toFixed(0),
      color: 'text-lavender',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {statItems.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center p-3 bg-muted/30 rounded-lg border border-border/30"
        >
          <item.icon className={`w-4 h-4 mb-1 ${item.color}`} />
          <span className="text-lg font-semibold tabular-nums">{item.value}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
})

export default TableStatsCard
