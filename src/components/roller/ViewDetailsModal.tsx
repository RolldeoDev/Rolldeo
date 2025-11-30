/**
 * ViewDetailsModal Component
 *
 * Modal for viewing detailed information about a table or template.
 * Shows name, description, type, tags, entry count, etc.
 */

import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Info, Tag, Hash, Layers, EyeOff, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import { useCollectionStore } from '@/stores/collectionStore'
import { TableTypeIcon } from './TableTypeIcon'

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
  const getTableList = useCollectionStore((state) => state.getTableList)
  const getTemplateList = useCollectionStore((state) => state.getTemplateList)
  const getCollection = useCollectionStore((state) => state.getCollection)

  // Get full item details
  const fullItem = useMemo(() => {
    if (item.type === 'template') {
      const templates = getTemplateList(collectionId)
      return templates.find((t) => t.id === item.id)
    } else {
      const tables = getTableList(collectionId)
      return tables.find((t) => t.id === item.id)
    }
  }, [item, collectionId, getTableList, getTemplateList])

  const collectionMeta = useMemo(() => {
    return getCollection(collectionId)
  }, [collectionId, getCollection])

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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-background border border-border rounded-lg shadow-xl',
          'w-full max-w-md mx-4 max-h-[80vh] flex flex-col',
          'animate-fade-in'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-auto space-y-4">
          {/* Name and Type */}
          <div className="flex items-start gap-3">
            <TableTypeIcon
              type={item.type === 'template' ? 'template' : (tableType as 'simple' | 'composite' | 'collection' || 'simple')}
              className="w-6 h-6 flex-shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold">{item.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">
                {item.type === 'template' ? 'Template' : `${tableType || 'Simple'} Table`}
              </p>
            </div>
            {item.hidden && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                <EyeOff className="w-3 h-3" />
                Hidden
              </div>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <div className="space-y-1">
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

          {/* Collection Info */}
          {collectionMeta && (
            <div className="pt-2 border-t border-border/50">
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

export default ViewDetailsModal
