/**
 * RollHistoryList Component
 *
 * Displays roll history with pin/delete actions and trace viewing.
 */

import { memo, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { History as HistoryIcon, Pin, PinOff, Trash2, Activity } from 'lucide-react'
import type { StoredRoll } from '@/services/db'
import { formatTimestamp } from '@/stores/rollStore'
import { cn } from '@/lib/utils'
import { TraceViewer } from './TraceViewer'

interface RollHistoryListProps {
  history: StoredRoll[]
  onPin: (id: number, pinned: boolean) => void
  onDelete: (id: number) => void
  onClearHistory: (keepPinned: boolean) => void
}

export const RollHistoryList = memo(function RollHistoryList({
  history,
  onPin,
  onDelete,
  onClearHistory,
}: RollHistoryListProps) {
  // Track which history items have their trace expanded (by item id)
  const [expandedTraces, setExpandedTraces] = useState<Set<number>>(new Set())

  const toggleTrace = useCallback((itemId: number) => {
    setExpandedTraces((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }, [])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="icon-container icon-lavender p-1.5">
            <HistoryIcon className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-semibold">History</h2>
          <span className="text-sm text-muted-foreground">({history.length})</span>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => onClearHistory(true)}
            className="text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear (keep pinned)
          </button>
        )}
      </div>

      {/* History List */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {history.length > 0 ? (
          history.slice(0, 50).map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'p-4 rounded-xl border transition-all duration-300 animate-slide-up',
                item.pinned
                  ? 'border-primary/30 card-elevated card-mint'
                  : 'border-white/5 hover:border-white/10 bg-white/[0.02]'
              )}
              style={{ animationDelay: `${index * 0.02}s` }}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{formatTimestamp(item.timestamp)}</span>
                    {(item.tableId || item.templateId) && (
                      <>
                        <span className="text-white/20">·</span>
                        <span className="truncate">{item.tableId || item.templateId}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => onPin(item.id!, !item.pinned)}
                    className={cn(
                      'p-1.5 rounded-lg transition-all',
                      item.pinned
                        ? 'text-primary bg-primary/10'
                        : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
                    )}
                    title={item.pinned ? 'Unpin' : 'Pin'}
                  >
                    {item.pinned ? (
                      <PinOff className="h-4 w-4" />
                    ) : (
                      <Pin className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => onDelete(item.id!)}
                    className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="prose-roll text-foreground/90 overflow-x-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.result.text}</ReactMarkdown>
              </div>

              {/* Trace toggle button - only shown if trace exists */}
              {item.result.trace && (
                <>
                  <button
                    onClick={() => toggleTrace(item.id!)}
                    className={cn(
                      'mt-3 text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all',
                      expandedTraces.has(item.id!)
                        ? 'text-primary border-primary/40 bg-primary/10'
                        : 'text-muted-foreground border-border/50 hover:border-border hover:bg-accent'
                    )}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    {expandedTraces.has(item.id!) ? 'Hide' : 'Show'} Trace
                    <span className="text-muted-foreground/60">
                      ({item.result.trace.stats.nodeCount} ops)
                    </span>
                  </button>

                  {/* Trace viewer */}
                  {expandedTraces.has(item.id!) && (
                    <div className="mt-3">
                      <TraceViewer
                        trace={item.result.trace}
                        onClose={() => toggleTrace(item.id!)}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
              <HistoryIcon className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground">Your roll history will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
})

export default RollHistoryList
