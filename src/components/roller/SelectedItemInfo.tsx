/**
 * SelectedItemInfo Component
 *
 * Shows the currently selected item (table/template) and the roll button.
 */

import { memo } from 'react'
import { Dices, Loader2 } from 'lucide-react'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import { TableTypeIcon } from './TableTypeIcon'
import { TraceToggle } from './TraceToggle'
import { useRollStore } from '@/stores/rollStore'

interface SelectedItemInfoProps {
  selectedItem: BrowserItem | null
  isRolling: boolean
  canRoll: boolean
  onRoll: () => void
}

export const SelectedItemInfo = memo(function SelectedItemInfo({
  selectedItem,
  isRolling,
  canRoll,
  onRoll,
}: SelectedItemInfoProps) {
  const traceEnabled = useRollStore((state) => state.traceEnabled)
  const setTraceEnabled = useRollStore((state) => state.setTraceEnabled)

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

  return (
    <div className="p-4 border-b border-white/5">
      {/* Selected Item Info */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          selectedItem.type === 'template' ? 'bg-lavender/10' : 'bg-mint/10'
        }`}>
          <TableTypeIcon
            type={selectedItem.type === 'template' ? 'template' : (selectedItem.tableType || 'simple')}
            className="w-6 h-6"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{selectedItem.name}</h3>
          {selectedItem.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {selectedItem.description}
            </p>
          )}
          {selectedItem.tags && selectedItem.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedItem.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Roll Options */}
      <div className="flex items-center justify-end mb-3">
        <TraceToggle
          enabled={traceEnabled}
          onChange={setTraceEnabled}
          disabled={isRolling}
        />
      </div>

      {/* Roll Button */}
      <button
        onClick={onRoll}
        disabled={!canRoll || isRolling}
        className={`
          btn-copper relative w-full flex items-center justify-center gap-3 py-4 text-lg font-bold
          ${isRolling ? 'animate-pulse' : ''}
        `}
      >
        {/* Glow effect */}
        <div
          className="absolute inset-0 rounded-xl blur-xl -z-10 opacity-50"
          style={{ backgroundColor: 'hsl(var(--copper-glow) / 0.3)' }}
        />

        {isRolling ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Dices className="h-6 w-6" />
        )}
        {isRolling ? 'Rolling...' : 'Roll!'}
        {!isRolling && (
          <span className="text-sm font-medium opacity-60 ml-1">(Space)</span>
        )}
      </button>
    </div>
  )
})

export default SelectedItemInfo
