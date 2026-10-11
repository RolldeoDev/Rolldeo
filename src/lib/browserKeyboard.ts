interface RowKeyEvent {
  key: string
  target: EventTarget
  currentTarget: EventTarget
  preventDefault: () => void
}

/** Row shortcuts must leave nested buttons' native keyboard activation intact. */
export function handleItemRowKeyDown(event: RowKeyEvent, actions: { onRoll: () => void; onSelect: () => void }): void {
  if (event.target !== event.currentTarget) return
  if (event.key === 'Enter') {
    event.preventDefault()
    actions.onRoll()
  } else if (event.key === ' ') {
    event.preventDefault()
    actions.onSelect()
  }
}

/** Empty results retain index zero so later results are immediately actionable. */
export function clampSelectionIndex(index: number, resultCount: number): number {
  return Math.max(0, Math.min(index, resultCount - 1))
}
