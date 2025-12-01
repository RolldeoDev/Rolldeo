/**
 * ResultsPanel Component
 *
 * Right panel container showing selected item info, roll result, and history.
 * Manages the shared descriptions drawer for both current result and history items.
 */

import { memo, useState, useCallback, useMemo } from 'react'
import type { RollResult, EntryDescription } from '@/engine/types'
import type { StoredRoll } from '@/services/db'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import { SelectedItemInfo } from './SelectedItemInfo'
import { CurrentRollResult } from './CurrentRollResult'
import { RollHistoryList } from './RollHistoryList'
import { DescriptionsDrawer } from './DescriptionsDrawer'

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

// Drawer state type
interface DrawerState {
  descriptions: EntryDescription[]
  sourceLabel?: string
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
  // Drawer state for descriptions
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null)

  // Open descriptions drawer
  const openDescriptions = useCallback((descriptions: EntryDescription[], sourceLabel?: string) => {
    setDrawerState({ descriptions, sourceLabel })
  }, [])

  // Close descriptions drawer
  const closeDescriptions = useCallback(() => {
    setDrawerState(null)
  }, [])

  // Get the current roll's ID from history (first item after a roll)
  // This is used to filter it out of the history list
  const currentRollId = useMemo((): number | null => {
    if (!currentResult || history.length === 0) return null
    // The first history item should be the current roll (just added)
    // Check if it matches by comparing the result text
    const firstHistoryItem = history[0]
    if (firstHistoryItem?.result.text === currentResult.text && firstHistoryItem.id != null) {
      return firstHistoryItem.id
    }
    return null
  }, [currentResult, history])

  return (
    <div className="flex flex-col h-full bg-background relative">
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
          onShowDescriptions={openDescriptions}
        />

        {/* Roll History */}
        <RollHistoryList
          history={history}
          currentRollId={currentRollId}
          onPin={onPin}
          onDelete={onDelete}
          onClearHistory={onClearHistory}
          onShowDescriptions={openDescriptions}
        />
      </div>

      {/* Descriptions Drawer */}
      <DescriptionsDrawer
        descriptions={drawerState?.descriptions || null}
        isOpen={drawerState !== null}
        onClose={closeDescriptions}
        sourceLabel={drawerState?.sourceLabel}
      />
    </div>
  )
})

export default ResultsPanel
