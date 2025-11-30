/**
 * Keyboard Shortcuts Hook
 *
 * Provides centralized keyboard shortcut handling for the application.
 */

import { useEffect, useCallback } from 'react'

export interface KeyboardShortcut {
  /** Key code (e.g., 'Space', 'Enter', 'Escape', 'KeyS') */
  key: string
  /** Whether Ctrl (or Cmd on Mac) is required */
  ctrlOrCmd?: boolean
  /** Whether Shift is required */
  shift?: boolean
  /** Whether Alt is required */
  alt?: boolean
  /** Handler function */
  handler: (event: KeyboardEvent) => void
  /** Description for UI hints */
  description?: string
  /** Whether to prevent default behavior */
  preventDefault?: boolean
}

export interface UseKeyboardShortcutsOptions {
  /** Shortcuts to register */
  shortcuts: KeyboardShortcut[]
  /** Whether shortcuts are currently enabled */
  enabled?: boolean
}

/**
 * Check if an element is an input-like element where shortcuts should be ignored
 */
function isInputElement(element: EventTarget | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false

  const tagName = element.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true
  }

  // Check for contenteditable
  if (element.isContentEditable) {
    return true
  }

  // Check for Monaco editor
  if (element.closest('.monaco-editor')) {
    return true
  }

  return false
}

/**
 * Check if the Ctrl/Cmd modifier is pressed (Cmd on Mac, Ctrl elsewhere)
 */
function isCtrlOrCmd(event: KeyboardEvent): boolean {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return isMac ? event.metaKey : event.ctrlKey
}

/**
 * Hook for registering keyboard shortcuts
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // Check each shortcut
      for (const shortcut of shortcuts) {
        // Check key match
        if (event.code !== shortcut.key && event.key !== shortcut.key) {
          continue
        }

        // Check modifiers
        if (shortcut.ctrlOrCmd && !isCtrlOrCmd(event)) {
          continue
        }
        if (shortcut.ctrlOrCmd === false && isCtrlOrCmd(event)) {
          continue
        }
        if (shortcut.shift && !event.shiftKey) {
          continue
        }
        if (shortcut.shift === false && event.shiftKey) {
          continue
        }
        if (shortcut.alt && !event.altKey) {
          continue
        }
        if (shortcut.alt === false && event.altKey) {
          continue
        }

        // Skip if focused on an input element (unless explicitly handling it)
        // Exception: Allow Escape key to work everywhere
        if (shortcut.key !== 'Escape' && isInputElement(event.target)) {
          continue
        }

        // Prevent default if specified
        if (shortcut.preventDefault !== false) {
          event.preventDefault()
        }

        // Call the handler
        shortcut.handler(event)
        return
      }
    },
    [shortcuts, enabled]
  )

  useEffect(() => {
    if (!enabled) return

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, enabled])
}

/**
 * Get a display string for a shortcut (e.g., "Ctrl+S" or "⌘S")
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const parts: string[] = []

  if (shortcut.ctrlOrCmd) {
    parts.push(isMac ? '⌘' : 'Ctrl')
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt')
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift')
  }

  // Format key name
  let keyName = shortcut.key
  if (keyName === 'Space') keyName = 'Space'
  else if (keyName === 'Escape') keyName = 'Esc'
  else if (keyName === 'Enter') keyName = '↵'
  else if (keyName.startsWith('Key')) keyName = keyName.slice(3)
  else if (keyName === 'Slash') keyName = '/'

  parts.push(keyName)

  return isMac ? parts.join('') : parts.join('+')
}

export default useKeyboardShortcuts
