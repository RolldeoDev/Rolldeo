/**
 * usePatternAutocomplete Hook
 *
 * Core logic for pattern autocomplete: trigger detection, cursor positioning,
 * keyboard navigation, and text insertion.
 */

import { useState, useCallback, useRef, useEffect, RefObject } from 'react'
import {
  filterSuggestions,
  type Suggestion,
  type FilterSuggestionsOptions,
} from './usePatternSuggestions'
import type { Table, Template } from '@/engine/types'

/**
 * Trigger types for autocomplete
 */
export type TriggerType = 'braces' | 'variable' | 'placeholder' | 'property'

/**
 * Information about the current trigger
 */
export interface TriggerInfo {
  /** Type of trigger detected */
  type: TriggerType
  /** Position in the text where trigger starts */
  startIndex: number
  /** Current cursor position */
  cursorIndex: number
  /** Partial input after the trigger (for filtering) */
  partialInput: string
  /** Screen position for dropdown */
  position: { top: number; left: number }
  /** For 'property' trigger: the target table/template ID to drill into */
  targetId?: string
  /** For 'property' trigger: the property chain so far (e.g., ["race"] for tableName.race.) */
  propertyChain?: string[]
}

/**
 * Options for usePatternAutocomplete
 */
export interface UsePatternAutocompleteOptions {
  /** Reference to the textarea element */
  textareaRef: RefObject<HTMLTextAreaElement>
  /** All available suggestions */
  suggestions: Suggestion[]
  /** Current text value */
  value: string
  /** Callback when value changes (for insertion) */
  onValueChange: (value: string) => void
  /** Full table data for property lookups (keyed by table ID) */
  tableMap?: Map<string, Table>
  /** Full template data for property lookups (keyed by template ID) */
  templateMap?: Map<string, Template>
}

/**
 * Return type for usePatternAutocomplete
 */
export interface UsePatternAutocompleteReturn {
  /** Whether the dropdown is open */
  isOpen: boolean
  /** Filtered suggestions based on trigger and partial input */
  filteredSuggestions: Suggestion[]
  /** Currently selected index */
  selectedIndex: number
  /** Set the selected index */
  setSelectedIndex: (index: number) => void
  /** Trigger information for positioning */
  triggerInfo: TriggerInfo | null
  /** Keyboard event handler - attach to textarea */
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  /** Input event handler - call after value changes */
  handleInput: () => void
  /** Confirm the currently selected or specified suggestion */
  confirm: (index?: number) => void
  /** Close the dropdown */
  close: () => void
}

/**
 * Get the pixel position of the cursor in a textarea
 * Uses the mirror div technique for accurate measurement
 */
function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number
): { top: number; left: number } {
  // Get computed styles
  const computed = window.getComputedStyle(textarea)

  // Create mirror div
  const mirror = document.createElement('div')
  mirror.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    visibility: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
  `

  // Copy relevant styles
  const stylesToCopy = [
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'letter-spacing',
    'text-transform',
    'word-spacing',
    'text-indent',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'box-sizing',
    'line-height',
  ]

  for (const style of stylesToCopy) {
    mirror.style.setProperty(style, computed.getPropertyValue(style))
  }

  // Set width to match textarea
  mirror.style.width = `${textarea.clientWidth}px`

  // Add text content up to cursor
  const textBeforeCursor = textarea.value.substring(0, position)
  mirror.textContent = textBeforeCursor

  // Add a zero-width span at cursor position
  const span = document.createElement('span')
  span.textContent = '|'
  mirror.appendChild(span)

  // Append to body, measure, and remove
  document.body.appendChild(mirror)
  const spanRect = span.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()
  document.body.removeChild(mirror)

  // Calculate position relative to mirror (which has same padding/border as textarea)
  return {
    top: spanRect.top - mirrorRect.top - textarea.scrollTop,
    left: spanRect.left - mirrorRect.left - textarea.scrollLeft,
  }
}

/**
 * Parse a property access chain like "tableName.@prop1.@prop2" or "@tableName.@prop1"
 * Returns the target ID and property chain (without @ prefixes), or null if not a valid chain
 */
function parsePropertyChain(text: string): { targetId: string; propertyChain: string[]; isPlaceholder: boolean } | null {
  // Match patterns like: tableName.@prop1.@prop2. or @tableName.@prop1.
  // The text should end with a dot (indicating we want to complete the next property)
  if (!text.endsWith('.')) {
    return null
  }

  // Remove trailing dot for parsing
  const chainText = text.slice(0, -1)

  // Check if it starts with @ (placeholder access like @tableName.prop)
  const isPlaceholder = chainText.startsWith('@')
  const cleanChain = isPlaceholder ? chainText.slice(1) : chainText

  // Split by dots, but handle @-prefixed properties
  // e.g., "tableName.@prop1.@prop2" -> ["tableName", "@prop1", "@prop2"]
  const parts = cleanChain.split('.')
  if (parts.length === 0 || !parts[0]) {
    return null
  }

  // First part is the target ID (table/template name)
  const targetId = parts[0]
  // Rest are the property chain - strip @ prefix from each
  const propertyChain = parts.slice(1).map(p => p.startsWith('@') ? p.slice(1) : p)

  // Validate that the target ID is a valid identifier
  const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  if (!identifierRegex.test(targetId)) {
    return null
  }
  // Validate each property in the chain (after @ removal)
  for (const prop of propertyChain) {
    if (!identifierRegex.test(prop)) {
      return null
    }
  }

  return { targetId, propertyChain, isPlaceholder }
}

/**
 * Detect if we're in a trigger context and extract trigger info
 */
function detectTrigger(
  value: string,
  cursorPos: number
): Omit<TriggerInfo, 'position'> | null {
  // Get text before cursor
  const textBeforeCursor = value.substring(0, cursorPos)

  // Check for unclosed {{ trigger
  // Find the last {{ that doesn't have a matching }}
  const lastDoubleBrace = textBeforeCursor.lastIndexOf('{{')
  if (lastDoubleBrace === -1) {
    return null
  }

  const textAfterBrace = textBeforeCursor.substring(lastDoubleBrace + 2)

  // Check if there's a closing }} between the {{ and cursor
  if (textAfterBrace.includes('}}')) {
    return null
  }

  // We're inside an unclosed {{ block

  // Check for property access trigger (.) - highest priority when after identifier.
  // Look for patterns like: tableName. or tableName.prop1. or @tableName.prop1.
  const lastDot = textAfterBrace.lastIndexOf('.')
  if (lastDot !== -1) {
    // Get text from start of expression to just after the last dot
    const textUpToDot = textAfterBrace.substring(0, lastDot + 1)

    // Find the start of this identifier chain (skip any prefix like unique:, 3*, etc.)
    // Look backwards from the last dot to find the start of the identifier chain
    // Pattern: optional @ + identifier, then any number of (.@?identifier) segments, ending with .
    const chainMatch = textUpToDot.match(/(@?[a-zA-Z_][a-zA-Z0-9_]*(?:\.@?[a-zA-Z_][a-zA-Z0-9_]*)*\.)$/)
    if (chainMatch) {
      const chainText = chainMatch[1]
      const parsed = parsePropertyChain(chainText)
      if (parsed) {
        const chainStartIndex = lastDoubleBrace + 2 + textUpToDot.length - chainText.length
        return {
          type: 'property',
          startIndex: chainStartIndex + chainText.length, // Position right after the dot
          cursorIndex: cursorPos,
          partialInput: textAfterBrace.substring(lastDot + 1), // Text after the last dot
          targetId: parsed.targetId,
          propertyChain: parsed.propertyChain,
        }
      }
    }
  }

  // Check for $ trigger (variable) - takes precedence over braces
  const lastDollar = textAfterBrace.lastIndexOf('$')
  if (lastDollar !== -1) {
    // Make sure $ is at start of identifier (not part of existing var name)
    const charBefore = lastDollar > 0 ? textAfterBrace[lastDollar - 1] : ''
    if (!charBefore || /[\s{|:*>]/.test(charBefore)) {
      return {
        type: 'variable',
        startIndex: lastDoubleBrace + 2 + lastDollar,
        cursorIndex: cursorPos,
        partialInput: textAfterBrace.substring(lastDollar + 1),
      }
    }
  }

  // Check for @ trigger (placeholder) - takes precedence over braces
  const lastAt = textAfterBrace.lastIndexOf('@')
  if (lastAt !== -1) {
    // Make sure @ is at start of identifier
    const charBefore = lastAt > 0 ? textAfterBrace[lastAt - 1] : ''
    if (!charBefore || /[\s{|:*>.]/.test(charBefore)) {
      return {
        type: 'placeholder',
        startIndex: lastDoubleBrace + 2 + lastAt,
        cursorIndex: cursorPos,
        partialInput: textAfterBrace.substring(lastAt + 1),
      }
    }
  }

  // Default: return braces trigger for general autocomplete
  return {
    type: 'braces',
    startIndex: lastDoubleBrace,
    cursorIndex: cursorPos,
    partialInput: textAfterBrace,
  }
}

/**
 * Insert a suggestion at the trigger position
 */
function insertSuggestion(
  value: string,
  triggerInfo: TriggerInfo,
  suggestion: Suggestion
): { newValue: string; newCursorPos: number } {
  const { type, startIndex, cursorIndex } = triggerInfo

  // Check if closing braces already exist after cursor
  const textAfterCursor = value.substring(cursorIndex)
  const hasClosingBraces = textAfterCursor.startsWith('}}')

  let insertText: string
  let newCursorPos: number

  switch (type) {
    case 'braces':
      // Replace from {{ to cursor with {{insertText}}
      // If }} already exists after cursor, don't add them again
      if (hasClosingBraces) {
        insertText = `{{${suggestion.insertText}`
        newCursorPos = startIndex + insertText.length + 2 // Position after existing }}
      } else {
        insertText = `{{${suggestion.insertText}}}`
        newCursorPos = startIndex + insertText.length
      }
      break

    case 'variable':
      // Replace from $ to cursor with $varName (no additional braces)
      insertText = suggestion.insertText // Already includes $
      newCursorPos = startIndex + insertText.length
      break

    case 'placeholder':
      // Replace from @ to cursor with @propName (no additional braces)
      insertText = suggestion.insertText // Already includes @
      newCursorPos = startIndex + insertText.length
      break

    case 'property':
      // Replace from position after the dot to cursor with @propertyName
      insertText = `@${suggestion.insertText}` // Add @ prefix for property access syntax
      newCursorPos = startIndex + insertText.length
      break

    default:
      return { newValue: value, newCursorPos: cursorIndex }
  }

  const newValue =
    value.substring(0, startIndex) + insertText + value.substring(cursorIndex)

  return { newValue, newCursorPos }
}

/**
 * Hook for pattern autocomplete functionality
 */
export function usePatternAutocomplete(
  options: UsePatternAutocompleteOptions
): UsePatternAutocompleteReturn {
  const { textareaRef, suggestions, value, onValueChange, tableMap, templateMap } = options

  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [triggerInfo, setTriggerInfo] = useState<TriggerInfo | null>(null)

  // Track pending cursor position after insertion
  const pendingCursorPos = useRef<number | null>(null)

  // Build filter options for property trigger
  const filterOptions: FilterSuggestionsOptions = triggerInfo?.type === 'property'
    ? {
        tableMap,
        templateMap,
        targetId: triggerInfo.targetId,
        propertyChain: triggerInfo.propertyChain,
      }
    : {}

  // Filter suggestions based on current trigger
  const filteredSuggestions = triggerInfo
    ? filterSuggestions(
        suggestions,
        triggerInfo.type,
        triggerInfo.partialInput,
        filterOptions
      )
    : []

  /**
   * Update trigger detection when cursor moves or value changes
   */
  const updateTrigger = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      setIsOpen(false)
      setTriggerInfo(null)
      return
    }

    // Read current value directly from textarea to avoid stale closure issues
    const currentValue = textarea.value
    const cursorPos = textarea.selectionStart
    const detected = detectTrigger(currentValue, cursorPos)

    // Show autocomplete if:
    // - We have regular suggestions, OR
    // - This is a property trigger and we have tableMap or templateMap for dynamic lookup
    const shouldShow = detected && (
      suggestions.length > 0 ||
      (detected.type === 'property' && (tableMap || templateMap))
    )

    if (shouldShow && detected) {
      const position = getCaretCoordinates(textarea, detected.startIndex)
      const textareaRect = textarea.getBoundingClientRect()

      setTriggerInfo({
        ...detected,
        position: {
          top: textareaRect.top + position.top + parseInt(window.getComputedStyle(textarea).lineHeight || '20'),
          left: textareaRect.left + position.left,
        },
      })
      setIsOpen(true)
      setSelectedIndex(0)
    } else {
      setIsOpen(false)
      setTriggerInfo(null)
    }
  }, [suggestions, textareaRef, tableMap, templateMap])

  /**
   * Handle input events - called after value changes
   */
  const handleInput = useCallback(() => {
    // Small delay to ensure cursor position is updated
    requestAnimationFrame(() => {
      updateTrigger()
    })
  }, [updateTrigger])

  /**
   * Close the dropdown
   */
  const close = useCallback(() => {
    setIsOpen(false)
    setTriggerInfo(null)
  }, [])

  /**
   * Confirm selection and insert text
   */
  const confirm = useCallback(
    (index?: number) => {
      const idx = index ?? selectedIndex
      if (!triggerInfo || idx < 0 || idx >= filteredSuggestions.length) {
        return
      }

      const suggestion = filteredSuggestions[idx]
      const { newValue, newCursorPos } = insertSuggestion(
        value,
        triggerInfo,
        suggestion
      )

      pendingCursorPos.current = newCursorPos
      onValueChange(newValue)
      close()
    },
    [triggerInfo, filteredSuggestions, value, onValueChange, close, selectedIndex]
  )

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isOpen || filteredSuggestions.length === 0) {
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) =>
            Math.min(i + 1, filteredSuggestions.length - 1)
          )
          break

        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break

        case 'Tab':
          e.preventDefault()
          confirm(selectedIndex)
          break

        case 'Enter':
          // Only prevent default and confirm if dropdown is open
          e.preventDefault()
          confirm(selectedIndex)
          break

        case 'Escape':
          e.preventDefault()
          close()
          break
      }
    },
    [isOpen, filteredSuggestions, selectedIndex, confirm, close]
  )

  /**
   * Restore cursor position after insertion
   */
  useEffect(() => {
    if (pendingCursorPos.current !== null && textareaRef.current) {
      const pos = pendingCursorPos.current
      pendingCursorPos.current = null
      requestAnimationFrame(() => {
        textareaRef.current?.setSelectionRange(pos, pos)
        textareaRef.current?.focus()
      })
    }
  }, [value, textareaRef])

  /**
   * Close dropdown when suggestions become empty
   */
  useEffect(() => {
    if (isOpen && filteredSuggestions.length === 0) {
      close()
    }
  }, [isOpen, filteredSuggestions.length, close])

  /**
   * Reset selected index when filtered suggestions change
   */
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredSuggestions.length])

  return {
    isOpen,
    filteredSuggestions,
    selectedIndex,
    setSelectedIndex,
    triggerInfo,
    handleKeyDown,
    handleInput,
    confirm,
    close,
  }
}
