/**
 * SelectionActionBar Component
 *
 * Displays inline with the filter bar when items are selected.
 * Shows selection count and batch action buttons (Delete, Export, Select All/None).
 */

import { memo } from 'react'
import { Trash2, Download, CheckSquare, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectionActionBarProps {
  /** Number of selected items */
  selectedCount: number
  /** Number of deletable items (non-preloaded) */
  deletableCount: number
  /** Callback for delete action */
  onDelete: () => void
  /** Callback for export action */
  onExport: () => void
  /** Callback for select all */
  onSelectAll: () => void
  /** Callback for select none (clear selection) */
  onSelectNone: () => void
  /** Total visible items (for select all) */
  totalVisibleCount: number
}

export const SelectionActionBar = memo(function SelectionActionBar({
  selectedCount,
  deletableCount,
  onDelete,
  onExport,
  onSelectAll,
  onSelectNone,
  totalVisibleCount,
}: SelectionActionBarProps) {
  const allSelected = selectedCount === totalVisibleCount && totalVisibleCount > 0
  const canDelete = deletableCount > 0

  return (
    <div className="flex items-center gap-2">
      {/* Selection count */}
      <span className="text-sm font-medium text-primary px-2">
        {selectedCount} selected
      </span>

      {/* Divider */}
      <div className="w-px h-5 bg-border/50" />

      {/* Select All / None toggle */}
      <button
        onClick={allSelected ? onSelectNone : onSelectAll}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg hover:bg-white/5 transition-colors"
        title={allSelected ? 'Deselect all' : 'Select all'}
      >
        {allSelected ? (
          <Square className="h-4 w-4" />
        ) : (
          <CheckSquare className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {allSelected ? 'None' : 'All'}
        </span>
      </button>

      {/* Export button */}
      <button
        onClick={onExport}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg hover:bg-white/5 transition-colors"
        title="Export selected collections"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
      </button>

      {/* Delete button */}
      <button
        onClick={onDelete}
        disabled={!canDelete}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg transition-colors',
          canDelete
            ? 'hover:bg-destructive/10 text-destructive'
            : 'opacity-50 cursor-not-allowed text-muted-foreground'
        )}
        title={
          canDelete
            ? `Delete ${deletableCount} collection${deletableCount !== 1 ? 's' : ''}`
            : 'No deletable collections selected (preloaded collections cannot be deleted)'
        }
      >
        <Trash2 className="h-4 w-4" />
        <span className="hidden sm:inline">
          Delete{canDelete && deletableCount !== selectedCount ? ` (${deletableCount})` : ''}
        </span>
      </button>
    </div>
  )
})

export default SelectionActionBar
