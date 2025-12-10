/**
 * ViewDetailsModal Component
 *
 * Modal for viewing detailed information about a table or template.
 * Shows name, description, type, tags, entry count, weight distribution, and inheritance.
 */

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Info, Tag, Hash, Layers, EyeOff, FileText, BarChart3, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import { useCollectionStore } from '@/stores/collectionStore'
import { useTableVisualization } from '@/hooks/useTableVisualization'
import { TableTypeIcon } from './TableTypeIcon'
import {
  WeightedEntryChart,
  SourceDistributionChart,
  CollectionSourceChart,
  TableStatsCard,
  InheritanceTree,
} from '@/components/visualization'

type TabId = 'info' | 'distribution' | 'inheritance'

interface ViewDetailsModalProps {
  item: BrowserItem
  collectionId: string
  onClose: () => void
}

export function ViewDetailsModal({
  item,
  collectionId,
  onClose,
}: ViewDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('info')

  // Subscribe to collections Map to trigger re-renders when data changes
  const collectionsMap = useCollectionStore((state) => state.collections)

  // Get full item details - use getState() to access functions
  const fullItem = useMemo(() => {
    const { getTableList, getTemplateList } = useCollectionStore.getState()
    if (item.type === 'template') {
      const templates = getTemplateList(collectionId)
      return templates.find((t) => t.id === item.id)
    } else {
      const tables = getTableList(collectionId)
      return tables.find((t) => t.id === item.id)
    }
  }, [item, collectionId, collectionsMap])

  const collectionMeta = useMemo(() => {
    return useCollectionStore.getState().getCollection(collectionId)
  }, [collectionId, collectionsMap])

  // Get visualization data for tables
  const visualization = useTableVisualization({
    collectionId,
    tableId: item.id,
    maxEntries: 20,
  })

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const isTable = item.type !== 'template'
  const tableType = isTable && fullItem && 'type' in fullItem ? (fullItem as { type: string }).type : 'simple'

  // Check if visualization tabs should be shown (only for tables)
  const showVisualizationTabs = isTable && visualization !== null

  const tabs: { id: TabId; label: string; icon: typeof Info }[] = [
    { id: 'info', label: 'Info', icon: Info },
    ...(showVisualizationTabs
      ? [
          { id: 'distribution' as TabId, label: 'Distribution', icon: BarChart3 },
          { id: 'inheritance' as TabId, label: 'Inheritance', icon: GitBranch },
        ]
      : []),
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-background border border-border rounded-lg shadow-xl',
          'w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col',
          'animate-fade-in'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <TableTypeIcon
              type={item.type === 'template' ? 'template' : (tableType as 'simple' | 'composite' | 'collection' || 'simple')}
              className="w-5 h-5"
            />
            <div>
              <h2 className="text-lg font-semibold leading-tight">{item.name}</h2>
              <p className="text-xs text-muted-foreground capitalize">
                {item.type === 'template' ? 'Template' : `${tableType || 'Simple'} Table`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-4 flex-1 overflow-auto">
          {activeTab === 'info' && (
            <InfoTabContent
              item={item}
              fullItem={fullItem}
              collectionMeta={collectionMeta}
              isTable={isTable}
              tableType={tableType}
            />
          )}

          {activeTab === 'distribution' && visualization && (
            <DistributionTabContent visualization={visualization} />
          )}

          {activeTab === 'inheritance' && visualization && (
            <InheritanceTabContent inheritance={visualization.inheritance} />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm',
              'hover:bg-accent transition-colors'
            )}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ============================================================================
// Tab Content Components
// ============================================================================

interface InfoTabContentProps {
  item: BrowserItem
  fullItem: unknown
  collectionMeta: { name: string; namespace?: string } | undefined
  isTable: boolean
  tableType: string
}

function InfoTabContent({
  item,
  collectionMeta,
  isTable,
}: InfoTabContentProps) {
  return (
    <div className="space-y-4">
      {/* Hidden badge */}
      {item.hidden && (
        <div className="flex items-center gap-1.5 text-xs text-amber bg-amber/10 px-3 py-2 rounded-lg">
          <EyeOff className="w-3.5 h-3.5" />
          This item is hidden from the browser list
        </div>
      )}

      {/* Description */}
      {item.description && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <FileText className="w-3.5 h-3.5" />
            Description
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {item.description}
          </p>
        </div>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Tag className="w-3.5 h-3.5" />
            Tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs rounded-md bg-primary/10 text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Entry Count (for tables) */}
      {isTable && item.entryCount !== undefined && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Hash className="w-3.5 h-3.5" />
            Entries
          </div>
          <span className="text-sm">{item.entryCount}</span>
        </div>
      )}

      {/* Result Type */}
      {item.resultType && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Info className="w-3.5 h-3.5" />
            Result Type
          </div>
          <span className="text-sm capitalize">{item.resultType}</span>
        </div>
      )}

      {/* Collection Info */}
      {collectionMeta && (
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            <Layers className="w-3.5 h-3.5" />
            Collection
          </div>
          <p className="text-sm">{collectionMeta.name}</p>
          {collectionMeta.namespace && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {collectionMeta.namespace}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

interface DistributionTabContentProps {
  visualization: NonNullable<ReturnType<typeof useTableVisualization>>
}

function DistributionTabContent({ visualization }: DistributionTabContentProps) {
  return (
    <div className="space-y-6">
      {/* Stats card */}
      <TableStatsCard stats={visualization.stats} tableType={visualization.type} />

      {/* Distribution chart */}
      <div>
        <h3 className="text-sm font-medium mb-3">
          {visualization.type === 'simple' && 'Entry Weight Distribution'}
          {visualization.type === 'composite' && 'Source Table Selection'}
          {visualization.type === 'collection' && 'Merged Table Contributions'}
        </h3>

        {visualization.type === 'simple' && (
          <WeightedEntryChart
            entries={visualization.entries}
            truncated={visualization.truncated}
            totalEntries={visualization.totalEntries}
          />
        )}

        {visualization.type === 'composite' && (
          <SourceDistributionChart sources={visualization.sources} />
        )}

        {visualization.type === 'collection' && (
          <CollectionSourceChart
            sources={visualization.sources}
            totalEntries={visualization.totalEntries}
          />
        )}
      </div>
    </div>
  )
}

interface InheritanceTabContentProps {
  inheritance: { tableId: string; tableName: string; entryCount: number; level: number }[]
}

function InheritanceTabContent({ inheritance }: InheritanceTabContentProps) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-4">Inheritance Chain</h3>
      <InheritanceTree nodes={inheritance} />
    </div>
  )
}

export default ViewDetailsModal
