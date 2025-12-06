/**
 * ResultsPanel Component
 *
 * Right panel container showing selected item info, roll result, and history.
 * Manages the shared descriptions drawer for both current result and history items.
 */

import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { RollResult, EntryDescription, EvaluatedSets } from '@/engine/types'
import type { StoredRoll } from '@/services/db'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import { SelectedItemInfo } from './SelectedItemInfo'
import { CurrentRollResult } from './CurrentRollResult'
import { RollHistoryList } from './RollHistoryList'
import { DescriptionsDrawer } from './DescriptionsDrawer'
import { SetsDrawer } from './SetsDrawer'

interface ResultsPanelProps {
  selectedItem: BrowserItem | null
  collectionId: string | null
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
  type: 'descriptions' | 'sets'
  descriptions?: EntryDescription[]
  sets?: EvaluatedSets
  sourceLabel?: string
}

export const ResultsPanel = memo(function ResultsPanel({
  selectedItem,
  collectionId,
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
  // Ref to scrollable content for scroll-to-top on roll
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Track the name of the item that was rolled (so it doesn't change when selection changes)
  const [rolledItemName, setRolledItemName] = useState<string | null>(null)

  // Drawer state for descriptions and sets
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null)

  // Open descriptions drawer
  const openDescriptions = useCallback((descriptions: EntryDescription[], sourceLabel?: string) => {
    setDrawerState({ type: 'descriptions', descriptions, sourceLabel })
  }, [])

  // Open sets drawer
  const openSets = useCallback((sets: EvaluatedSets, sourceLabel?: string) => {
    setDrawerState({ type: 'sets', sets, sourceLabel })
  }, [])

  // Close drawer
  const closeDrawer = useCallback(() => {
    setDrawerState(null)
  }, [])

  // Capture the item name when rolling starts
  useEffect(() => {
    if (isRolling && selectedItem) {
      setRolledItemName(selectedItem.name)
    }
  }, [isRolling, selectedItem])

  // Handle roll with scroll-to-top
  const handleRoll = useCallback(() => {
    onRoll()
    // Scroll to top of the results area
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [onRoll])

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
          collectionId={collectionId}
          isRolling={isRolling}
          canRoll={canRoll}
          onRoll={handleRoll}
        />
      </div>

      {/* Scrollable content area for result and history */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto">
        {/* Current Roll Result */}
        <CurrentRollResult
          result={currentResult}
          itemName={rolledItemName}
          isRolling={isRolling}
          error={rollError}
          onReroll={handleRoll}
          onShowDescriptions={openDescriptions}
          onShowSets={openSets}
        />

        {/* Roll History */}
        <RollHistoryList
          history={history}
          currentRollId={currentRollId}
          onPin={onPin}
          onDelete={onDelete}
          onClearHistory={onClearHistory}
          onShowDescriptions={openDescriptions}
          onShowSets={openSets}
        />
      </div>

      {/* Descriptions Drawer */}
      <DescriptionsDrawer
        descriptions={drawerState?.type === 'descriptions' ? drawerState.descriptions || null : null}
        isOpen={drawerState?.type === 'descriptions'}
        onClose={closeDrawer}
        sourceLabel={drawerState?.sourceLabel}
      />

      {/* Sets Drawer */}
      <SetsDrawer
        sets={drawerState?.type === 'sets' ? drawerState.sets || null : null}
        isOpen={drawerState?.type === 'sets'}
        onClose={closeDrawer}
        sourceLabel={drawerState?.sourceLabel}
      />
    </div>
  )
})

export default ResultsPanel
