/**
 * HighlightedInput Component
 *
 * Single-line input with syntax highlighting for {{...}} expressions.
 * Uses the same overlay technique as EditablePattern but for input elements.
 * Optionally supports autocomplete for table/template references.
 */

import { memo, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { renderHighlightedText } from './highlightUtils'
import { usePatternAutocomplete } from '@/hooks/usePatternAutocomplete'
import { AutocompleteDropdown } from '../AutocompleteDropdown'
import type { Suggestion } from '@/hooks/usePatternSuggestions'
import type { Table, Template } from '@/engine/types'

export interface HighlightedInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Classes applied to the input element */
  className?: string
  /** Classes applied to the wrapper div (for flex layout) */
  wrapperClassName?: string
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  /** Suggestions for autocomplete (optional - if not provided, autocomplete is disabled) */
  suggestions?: Suggestion[]
  /** Full table data for property lookups (keyed by table ID) */
  tableMap?: Map<string, Table>
  /** Full template data for property lookups (keyed by template ID) */
  templateMap?: Map<string, Template>
  /** Shared variables map for variable property lookups (keyed by variable name without $) */
  sharedVariables?: Record<string, string>
}

export interface HighlightedInputRef {
  /** Insert text at current cursor position */
  insertAtCursor: (text: string) => void
  /** Focus the input */
  focus: () => void
  /** Get selection start position */
  get selectionStart(): number | null
  /** Get selection end position */
  get selectionEnd(): number | null
}

/**
 * HighlightedInput with input + overlay for syntax highlighting
 */
export const HighlightedInput = memo(
  forwardRef<HighlightedInputRef, HighlightedInputProps>(function HighlightedInput(
    { value, onChange, placeholder, className, wrapperClassName, onFocus, onBlur, onKeyDown, suggestions = [], tableMap, templateMap, sharedVariables },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)

    // Autocomplete hook - uses a ref adapter since usePatternAutocomplete expects textarea
    // We cast the input ref to work with the hook (both have same selectionStart/value properties)
    const autocomplete = usePatternAutocomplete({
      textareaRef: inputRef as unknown as React.RefObject<HTMLTextAreaElement>,
      suggestions,
      value,
      onValueChange: onChange,
      tableMap,
      templateMap,
      sharedVariables,
    })

    /**
     * Sync scroll position between input and overlay
     */
    const syncScroll = useCallback(() => {
      if (inputRef.current && overlayRef.current) {
        overlayRef.current.scrollLeft = inputRef.current.scrollLeft
      }
    }, [])

    /**
     * Handle input change
     */
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value)
        // Trigger autocomplete detection after value change
        autocomplete.handleInput()
      },
      [onChange, autocomplete]
    )

    /**
     * Handle keyboard events - integrate with autocomplete
     */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Let autocomplete handle navigation keys first
        if (autocomplete.isOpen) {
          autocomplete.handleKeyDown(e as unknown as React.KeyboardEvent<HTMLTextAreaElement>)
          // If autocomplete handled the key, don't propagate
          if (e.defaultPrevented) return
        }
        // Pass through to parent handler
        onKeyDown?.(e)
      },
      [autocomplete, onKeyDown]
    )

    /**
     * Insert text at cursor position
     */
    const insertAtCursor = useCallback(
      (text: string) => {
        const input = inputRef.current
        if (!input) return

        const safeValue = value ?? ''
        const start = input.selectionStart ?? safeValue.length
        const end = input.selectionEnd ?? safeValue.length
        const newValue = safeValue.slice(0, start) + text + safeValue.slice(end)

        onChange(newValue)

        // Restore cursor position after the inserted text
        requestAnimationFrame(() => {
          input.focus()
          const newPos = start + text.length
          input.setSelectionRange(newPos, newPos)
        })
      },
      [value, onChange]
    )

    /**
     * Focus the input
     */
    const focus = useCallback(() => {
      inputRef.current?.focus()
    }, [])

    /**
     * Expose methods via ref
     */
    useImperativeHandle(
      ref,
      () => ({
        insertAtCursor,
        focus,
        get selectionStart() {
          return inputRef.current?.selectionStart ?? null
        },
        get selectionEnd() {
          return inputRef.current?.selectionEnd ?? null
        },
      }),
      [insertAtCursor, focus]
    )

    const hasExpressions = value?.includes('{{') ?? false

    // Extract template IDs from templateMap for proper highlighting
    const templateIds = useMemo(() => {
      if (!templateMap || templateMap.size === 0) return undefined
      return new Set(templateMap.keys())
    }, [templateMap])

    return (
      <div className={cn('relative', wrapperClassName)}>
        {/* Syntax-highlighted overlay (visual only) - only render when expressions exist */}
        {hasExpressions && (
          <div
            ref={overlayRef}
            className={cn(
              'absolute top-0 left-0 right-0 bottom-0',
              'pointer-events-none overflow-hidden whitespace-nowrap',
              'flex items-center',
              // Inherit the same styling as the input for perfect alignment
              // This includes padding, font-size, font-family from className
              className,
              'text-foreground',
              // Remove any background/border that might come from className
              '!bg-transparent !border-transparent !shadow-none !ring-0'
            )}
            aria-hidden="true"
          >
            {renderHighlightedText(value ?? '', { whiteSpace: 'pre', expressionClassName: 'whitespace-pre', templateIds })}
          </div>
        )}

        {/* Actual input (handles editing) */}
        <input
          ref={inputRef}
          type="text"
          value={value ?? ''}
          onChange={handleChange}
          onScroll={syncScroll}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            className,
            // Make text transparent when there are expressions to show overlay
            hasExpressions && 'highlighted-input-transparent'
          )}
          spellCheck={false}
        />

        {/* Autocomplete dropdown */}
        {autocomplete.isOpen && autocomplete.triggerInfo && (
          <AutocompleteDropdown
            suggestions={autocomplete.filteredSuggestions}
            selectedIndex={autocomplete.selectedIndex}
            position={autocomplete.triggerInfo.position}
            onSelect={autocomplete.setSelectedIndex}
            onConfirm={autocomplete.confirm}
            onClose={autocomplete.close}
            isPropertyTrigger={autocomplete.triggerInfo.type === 'property'}
          />
        )}
      </div>
    )
  })
)

export default HighlightedInput
