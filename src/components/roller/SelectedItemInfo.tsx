/**
 * SelectedItemInfo Component
 *
 * Shows the currently selected item (table/template) with collapsible metadata
 * and the roll button.
 */

import { memo, useState, useMemo } from 'react'
import { Dices, Loader2, ChevronDown, ChevronRight, ExternalLink, Book, User } from 'lucide-react'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import { TableTypeIcon } from './TableTypeIcon'
import { TraceToggle } from './TraceToggle'
import { useRollStore } from '@/stores/rollStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import type { Table, Template, TableSource } from '@/engine/types'

interface SelectedItemInfoProps {
  selectedItem: BrowserItem | null
  collectionId: string | null
  isRolling: boolean
  canRoll: boolean
  onRoll: () => void
}

export const SelectedItemInfo = memo(function SelectedItemInfo({
  selectedItem,
  collectionId,
  isRolling,
  canRoll,
  onRoll,
}: SelectedItemInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const traceEnabled = useRollStore((state) => state.traceEnabled)
  const setTraceEnabled = useRollStore((state) => state.setTraceEnabled)
  const getCollectionDocument = useCollectionStore((state) => state.getCollectionDocument)
  const resultTheme = useUIStore((state) => state.resultTheme)

  // Get the full document to access metadata and table/template details
  const documentData = useMemo(() => {
    if (!collectionId || !selectedItem) return null

    const doc = getCollectionDocument(collectionId)
    if (!doc) return null

    // Find the specific table or template
    let itemDetails: Table | Template | undefined
    let tableSource: TableSource | undefined

    if (selectedItem.type === 'template') {
      itemDetails = doc.templates?.find(t => t.id === selectedItem.id)
    } else {
      const table = doc.tables?.find(t => t.id === selectedItem.id)
      itemDetails = table
      tableSource = table?.source
    }

    return {
      metadata: doc.metadata,
      itemDetails,
      tableSource,
    }
  }, [collectionId, selectedItem, getCollectionDocument])

  if (!selectedItem) {
    return (
      <div className="p-6 border-b border-white/5">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
            <Dices className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground">Select a table or template to roll</p>
        </div>
      </div>
    )
  }

  const metadata = documentData?.metadata
  const tableSource = documentData?.tableSource
  const hasMetadataContent = !!(
    selectedItem.description ||
    metadata?.author ||
    metadata?.source ||
    tableSource ||
    (selectedItem.tags && selectedItem.tags.length > 0)
  )

  return (
    <div className="p-4 border-b border-white/5">
      {/* Header Row */}
      <div className="flex items-center gap-3">
        {/* Clickable area for expand/collapse */}
        <button
          onClick={() => hasMetadataContent && setIsExpanded(!isExpanded)}
          className={`flex items-center gap-3 flex-1 min-w-0 text-left ${
            hasMetadataContent ? 'cursor-pointer hover:bg-white/5 -ml-2 pl-2 py-2 pr-3 rounded-lg transition-colors' : 'cursor-default'
          }`}
          disabled={!hasMetadataContent}
        >
          {/* Type Icon */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            selectedItem.type === 'template' ? 'bg-lavender/10' : 'bg-mint/10'
          }`}>
            <TableTypeIcon
              type={selectedItem.type === 'template' ? 'template' : (selectedItem.tableType || 'simple')}
              className="w-5 h-5"
            />
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{selectedItem.name}</h3>
          </div>

          {/* Expand/Collapse Indicator */}
          {hasMetadataContent && (
            <div className="flex-shrink-0 text-muted-foreground">
              {isExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </div>
          )}
        </button>

        {/* Trace Toggle - always visible in header */}
        <div className="flex-shrink-0">
          <TraceToggle
            enabled={traceEnabled}
            onChange={setTraceEnabled}
            disabled={isRolling}
          />
        </div>
      </div>

      {/* Expanded Metadata Section */}
      {isExpanded && hasMetadataContent && (
        <div className="mt-3 ml-13 pl-13 space-y-3 text-sm">
          {/* Description */}
          {selectedItem.description && (
            <p className="text-muted-foreground leading-relaxed">
              {selectedItem.description}
            </p>
          )}

          {/* Collection Author */}
          {metadata?.author && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4 flex-shrink-0" />
              <span>{metadata.author}</span>
            </div>
          )}

          {/* Collection Source */}
          {metadata?.source && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <Book className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex flex-wrap items-center gap-x-2">
                {metadata.source.book && <span>{metadata.source.book}</span>}
                {metadata.source.publisher && (
                  <span className="text-muted-foreground/70">by {metadata.source.publisher}</span>
                )}
                {metadata.source.url && (
                  <a
                    href={metadata.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-copper hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Table-specific Source (if different from collection) */}
          {tableSource && (
            <div className="flex items-start gap-2 text-muted-foreground border-l-2 border-white/10 pl-3 ml-1">
              <Book className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex flex-wrap items-center gap-x-2">
                {tableSource.book && <span>{tableSource.book}</span>}
                {tableSource.page && <span className="text-muted-foreground/70">p. {tableSource.page}</span>}
                {tableSource.section && <span className="text-muted-foreground/70">({tableSource.section})</span>}
                {tableSource.url && (
                  <a
                    href={tableSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-copper hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {tableSource.license && (
                  <span className="text-xs px-1.5 py-0.5 bg-white/5 rounded text-muted-foreground/70">
                    {tableSource.license}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Rights/License Info */}
          {metadata?.rights && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
              {metadata.rights.type && (
                <span className="px-2 py-0.5 bg-white/5 rounded capitalize">
                  {metadata.rights.type.replace('-', ' ')}
                </span>
              )}
              {metadata.source?.license && (
                <span className="px-2 py-0.5 bg-white/5 rounded">
                  {metadata.source.license}
                </span>
              )}
            </div>
          )}

          {/* Tags */}
          {selectedItem.tags && selectedItem.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedItem.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-muted-foreground border border-white/10"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Roll Button */}
      <button
        onClick={onRoll}
        disabled={!canRoll || isRolling}
        className={cn(
          "relative w-full flex items-center justify-center gap-3 py-4 text-lg font-bold mt-4",
          resultTheme !== 'default' ? `btn-roll-${resultTheme}` : 'btn-copper',
          isRolling && 'animate-pulse'
        )}
      >
        {/* Glow effect - only for default theme */}
        {resultTheme === 'default' && (
          <div
            className="absolute inset-0 rounded-xl blur-xl -z-10 opacity-50"
            style={{ backgroundColor: 'hsl(var(--copper-glow) / 0.3)' }}
          />
        )}

        {isRolling ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Dices className="h-6 w-6" />
        )}
        {isRolling ? 'Rolling...' : 'Roll!'}
        {!isRolling && (
          <span className={cn(
            "text-sm font-medium ml-2 px-2 py-0.5 rounded",
            resultTheme === 'default' && 'bg-white/20 text-white/80',
            resultTheme === 'ttrpg' && 'bg-[hsl(25,45%,25%,0.3)] text-[hsl(35,60%,85%)]',
            resultTheme === 'cyberpunk' && 'bg-[hsl(186,100%,50%,0.2)] text-[hsl(186,100%,70%)]'
          )}>
            Space
          </span>
        )}
      </button>
    </div>
  )
})

export default SelectedItemInfo
