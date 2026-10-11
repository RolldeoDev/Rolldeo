import { describe, expect, it, vi } from 'vitest'
import { clampSelectionIndex, handleItemRowKeyDown } from './browserKeyboard'

describe('browser row keyboard actions', () => {
  it.each(['Enter', ' '])('leaves %s activation of a nested action button to the browser', (key) => {
    const row = new EventTarget()
    const button = new EventTarget()
    const preventDefault = vi.fn()
    const actions = { onRoll: vi.fn(), onSelect: vi.fn() }
    handleItemRowKeyDown({ key, target: button, currentTarget: row, preventDefault }, actions)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(actions.onRoll).not.toHaveBeenCalled()
    expect(actions.onSelect).not.toHaveBeenCalled()
  })

  it('rolls on Enter and selects on Space when the row itself has focus', () => {
    const row = new EventTarget()
    const preventDefault = vi.fn()
    const actions = { onRoll: vi.fn(), onSelect: vi.fn() }
    for (const key of ['Enter', ' ']) {
      handleItemRowKeyDown({ key, target: row, currentTarget: row, preventDefault }, actions)
    }
    expect(preventDefault).toHaveBeenCalledTimes(2)
    expect(actions.onRoll).toHaveBeenCalledTimes(1)
    expect(actions.onSelect).toHaveBeenCalledTimes(1)
    handleItemRowKeyDown({ key: 'Tab', target: row, currentTarget: row, preventDefault }, actions)
    expect(preventDefault).toHaveBeenCalledTimes(2)
  })
})

describe('palette selection recovery', () => {
  it('keeps the first result actionable after navigating an empty search', () => {
    let selectedIndex = 0
    for (let i = 0; i < 3; i++) selectedIndex = clampSelectionIndex(selectedIndex + 1, 0)
    const results = ['first', 'second']
    selectedIndex = clampSelectionIndex(selectedIndex, results.length)
    expect(results[selectedIndex]).toBe('first')
    expect(results[clampSelectionIndex(selectedIndex + 1, results.length)]).toBe('second')
  })

  it('repairs both bounds when results change', () => {
    expect(clampSelectionIndex(-1, 3)).toBe(0)
    expect(clampSelectionIndex(10, 2)).toBe(1)
    expect(clampSelectionIndex(1, 0)).toBe(0)
  })
})
