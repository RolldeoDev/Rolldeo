/**
 * ResultsPanel Component
 *
 * Right panel container showing selected item info, roll result, and history.
 * Manages the shared descriptions drawer for both current result and history items.
 */

import { memo, useState, useCallback, useRef } from 'react'
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
  currentRoll: StoredRoll | null
  currentItemName: string | null
  onReroll: (source: StoredRoll) => void
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
  currentRoll,
  currentItemName,
  onReroll,
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

  // Handle roll with scroll-to-top
  const handleRoll = useCallback(() => {
    onRoll()
    // Scroll to top of the results area
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [onRoll])

  const currentRollId = currentRoll?.id ?? null

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
          itemName={currentItemName}
          isRolling={isRolling}
          error={rollError}
          onReroll={() => { if (currentRoll) onReroll(currentRoll) }}
          pinned={currentRoll?.pinned ?? false}
          onPin={currentRollId === null ? undefined : () => onPin(currentRollId, !currentRoll?.pinned)}
          onDelete={currentRollId === null ? undefined : () => onDelete(currentRollId)}
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
