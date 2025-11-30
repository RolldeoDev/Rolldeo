/**
 * ResultsPanel Component
 *
 * Right panel container showing selected item info, roll result, and history.
 */

import { memo } from 'react'
import type { RollResult } from '@/engine/types'
import type { StoredRoll } from '@/services/db'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import { SelectedItemInfo } from './SelectedItemInfo'
import { CurrentRollResult } from './CurrentRollResult'
import { RollHistoryList } from './RollHistoryList'

interface ResultsPanelProps {
  selectedItem: BrowserItem | null
  currentResult: RollResult | null
  isRolling: boolean
  rollError: string | null
  canRoll: boolean
  history: StoredRoll[]
  onRoll: () => void
  onPin: (id: number, pinned: boolean) => void
  onDelete: (id: number) => void
  onClearHistory: (keepPinned: boolean) => void
}

export const ResultsPanel = memo(function ResultsPanel({
  selectedItem,
  currentResult,
  isRolling,
  rollError,
  canRoll,
  history,
  onRoll,
  onPin,
  onDelete,
  onClearHistory,
}: ResultsPanelProps) {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Fixed header with selected item and roll button */}
      <div className="flex-shrink-0">
        <SelectedItemInfo
          selectedItem={selectedItem}
          isRolling={isRolling}
          canRoll={canRoll}
          onRoll={onRoll}
        />
      </div>

      {/* Scrollable content area for result and history */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Current Roll Result */}
        <CurrentRollResult
          result={currentResult}
          itemName={selectedItem?.name || null}
          isRolling={isRolling}
          error={rollError}
          onReroll={onRoll}
        />

        {/* Roll History */}
        <RollHistoryList
          history={history}
          onPin={onPin}
          onDelete={onDelete}
          onClearHistory={onClearHistory}
        />
      </div>
    </div>
  )
})

export default ResultsPanel
