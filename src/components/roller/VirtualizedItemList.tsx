/**
 * VirtualizedItemList Component
 *
 * Efficiently renders large lists of tables/templates using virtualization.
 * Supports both flat and grouped view modes.
 */

import { useRef, memo, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { BrowserItem, GroupedItems } from '@/hooks/useBrowserFilter'
import { BrowserListItem } from './BrowserListItem'

interface VirtualizedItemListProps {
  /** Items for flat view */
  items: BrowserItem[]
  /** Grouped items for grouped view */
  groupedItems: GroupedItems[]
  /** Whether in grouped view mode */
  isGrouped: boolean
  /** Currently selected item ID */
  selectedItemId: string | null
  /** Callback when an item is selected */
  onSelectItem: (item: BrowserItem) => void
  /** Callback when an item is rolled */
  onRollItem: (item: BrowserItem) => void
  /** Callback when edit is requested */
  onEditItem?: (item: BrowserItem) => void
  /** Callback to copy roll result */
  onCopyResult?: (item: BrowserItem) => void
  /** Callback to roll multiple times */
  onRollMultiple?: (item: BrowserItem) => void
  /** Callback to view item details */
  onViewDetails?: (item: BrowserItem) => void
}

interface VirtualRow {
  type: 'item' | 'group-header'
  item?: BrowserItem
  groupName?: string
  /** Unique key for this row (handles items appearing in multiple groups) */
  uniqueKey: string
}

const ITEM_HEIGHT = 52
const GROUP_HEADER_HEIGHT = 36
const OVERSCAN = 5

export const VirtualizedItemList = memo(function VirtualizedItemList({
  items,
  groupedItems,
  isGrouped,
  selectedItemId,
  onSelectItem,
  onRollItem,
  onEditItem,
  onCopyResult,
  onRollMultiple,
  onViewDetails,
}: VirtualizedItemListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Flatten grouped items into virtual rows
  const virtualRows = useMemo((): VirtualRow[] => {
    if (!isGrouped) {
      return items.map((item) => ({
        type: 'item' as const,
        item,
        uniqueKey: `item-${item.id}`,
      }))
    }

    const rows: VirtualRow[] = []
    for (const group of groupedItems) {
      rows.push({
        type: 'group-header',
        groupName: group.groupName,
        uniqueKey: `group-${group.groupName}`,
      })
      for (const item of group.items) {
        // Include group name in key to handle items appearing in multiple groups
        rows.push({
          type: 'item',
          item,
          uniqueKey: `item-${group.groupName}-${item.id}`,
        })
      }
    }
    return rows
  }, [items, groupedItems, isGrouped])

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      virtualRows[index].type === 'group-header' ? GROUP_HEADER_HEIGHT : ITEM_HEIGHT,
    overscan: OVERSCAN,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()

  if (virtualRows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">No items found</p>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const row = virtualRows[virtualRow.index]

          if (row.type === 'group-header') {
            return (
              <div
                key={row.uniqueKey}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="px-3 py-2 bg-background border-b border-white/5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {row.groupName}
                  </span>
                </div>
              </div>
            )
          }

          const item = row.item!
          return (
            <div
              key={row.uniqueKey}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <BrowserListItem
                item={item}
                isSelected={selectedItemId === item.id}
                onSelect={() => onSelectItem(item)}
                onRoll={() => onRollItem(item)}
                onEdit={onEditItem ? () => onEditItem(item) : undefined}
                onCopyResult={onCopyResult ? () => onCopyResult(item) : undefined}
                onRollMultiple={onRollMultiple ? () => onRollMultiple(item) : undefined}
                onViewDetails={onViewDetails ? () => onViewDetails(item) : undefined}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default VirtualizedItemList
