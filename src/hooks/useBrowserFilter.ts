/**
 * useBrowserFilter Hook
 *
 * Memoized filtering and grouping logic for the browser panel.
 * Handles search filtering and grouping by type, tag, or alphabetically.
 */

import { useMemo } from 'react'
import type { TableInfo, TemplateInfo } from '@/engine/core'
import type { BrowserGroupBy, BrowserViewMode } from '@/stores/uiStore'
import { useDebouncedValue } from './useDebouncedValue'

export interface BrowserItem {
  id: string
  name: string
  type: 'table' | 'template'
  tableType?: 'simple' | 'composite' | 'collection'
  description?: string
  tags?: string[]
  hidden?: boolean
  entryCount?: number
}

export interface GroupedItems {
  groupName: string
  items: BrowserItem[]
}

interface UseBrowserFilterOptions {
  tables: TableInfo[]
  templates: TemplateInfo[]
  searchQuery: string
  viewMode: BrowserViewMode
  groupBy: BrowserGroupBy
  activeTab: 'tables' | 'templates'
  showHidden?: boolean
}

interface UseBrowserFilterReturn {
  /** Filtered items (for flat view) */
  filteredItems: BrowserItem[]
  /** Grouped items (for grouped view) */
  groupedItems: GroupedItems[]
  /** Debounced search query */
  debouncedQuery: string
  /** Total count of items (before filtering) */
  totalCount: number
  /** Count of filtered items */
  filteredCount: number
}

export function useBrowserFilter({
  tables,
  templates,
  searchQuery,
  viewMode,
  groupBy,
  activeTab,
  showHidden = false,
}: UseBrowserFilterOptions): UseBrowserFilterReturn {
  // Debounce search query for performance
  const debouncedQuery = useDebouncedValue(searchQuery, 300)

  // Convert to unified BrowserItem format
  const allItems = useMemo((): BrowserItem[] => {
    if (activeTab === 'tables') {
      return tables.map((table) => ({
        id: table.id,
        name: table.name,
        type: 'table' as const,
        tableType: table.type,
        description: table.description,
        tags: table.tags,
        hidden: table.hidden,
        entryCount: table.entryCount,
      }))
    } else {
      return templates.map((template) => ({
        id: template.id,
        name: template.name,
        type: 'template' as const,
        description: template.description,
        tags: template.tags,
      }))
    }
  }, [tables, templates, activeTab])

  // Filter items by search query and hidden status
  const filteredItems = useMemo((): BrowserItem[] => {
    const query = debouncedQuery.toLowerCase().trim()

    return allItems.filter((item) => {
      // Filter hidden items unless showHidden is true
      if (!showHidden && item.hidden) return false

      // Filter by search query
      if (!query) return true

      // Search in name
      if (item.name.toLowerCase().includes(query)) return true

      // Search in description
      if (item.description?.toLowerCase().includes(query)) return true

      // Search in tags
      if (item.tags?.some((tag) => tag.toLowerCase().includes(query))) return true

      return false
    })
  }, [allItems, debouncedQuery, showHidden])

  // Group items based on groupBy setting
  const groupedItems = useMemo((): GroupedItems[] => {
    if (viewMode !== 'grouped' || !groupBy) {
      return []
    }

    const groups = new Map<string, BrowserItem[]>()

    for (const item of filteredItems) {
      let groupKeys: string[]

      switch (groupBy) {
        case 'type':
          // Group by table type (simple/composite/collection) or template
          if (item.type === 'template') {
            groupKeys = ['Templates']
          } else {
            const typeLabel =
              item.tableType === 'simple'
                ? 'Simple Tables'
                : item.tableType === 'composite'
                  ? 'Composite Tables'
                  : 'Collection Tables'
            groupKeys = [typeLabel]
          }
          break

        case 'tag':
          // Group by tags (item can appear in multiple groups)
          groupKeys = item.tags?.length ? item.tags : ['Untagged']
          break

        case 'alpha':
          // Group by first letter
          const firstChar = item.name.charAt(0).toUpperCase()
          groupKeys = [/[A-Z]/.test(firstChar) ? firstChar : '#']
          break

        default:
          groupKeys = ['Other']
      }

      for (const key of groupKeys) {
        const existing = groups.get(key) || []
        existing.push(item)
        groups.set(key, existing)
      }
    }

    // Convert to array and sort
    const result = Array.from(groups.entries()).map(([groupName, items]) => ({
      groupName,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }))

    // Sort groups
    if (groupBy === 'alpha') {
      result.sort((a, b) => {
        if (a.groupName === '#') return 1
        if (b.groupName === '#') return -1
        return a.groupName.localeCompare(b.groupName)
      })
    } else if (groupBy === 'type') {
      const typeOrder = ['Simple Tables', 'Composite Tables', 'Collection Tables', 'Templates']
      result.sort((a, b) => typeOrder.indexOf(a.groupName) - typeOrder.indexOf(b.groupName))
    } else {
      // Tag grouping: sort alphabetically, but "Untagged" last
      result.sort((a, b) => {
        if (a.groupName === 'Untagged') return 1
        if (b.groupName === 'Untagged') return -1
        return a.groupName.localeCompare(b.groupName)
      })
    }

    return result
  }, [filteredItems, viewMode, groupBy])

  return {
    filteredItems,
    groupedItems,
    debouncedQuery,
    totalCount: allItems.length,
    filteredCount: filteredItems.length,
  }
}

export default useBrowserFilter
