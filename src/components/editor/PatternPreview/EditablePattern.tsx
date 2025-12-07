/**
 * EditablePattern Component
 *
 * Editable pattern area using textarea + overlay technique.
 * - Textarea handles all editing natively (cursor, selection, undo/redo, IME)
 * - Transparent textarea text with visible caret
 * - Overlay div shows syntax-highlighted version
 * - Optional autocomplete on {{ $ @ triggers
 */

import {
  memo,
  useRef,
  useCallback,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { cn } from '@/lib/utils'
import { usePatternAutocomplete } from '@/hooks/usePatternAutocomplete'
import { AutocompleteDropdown } from '../AutocompleteDropdown'
import { renderHighlightedText } from './highlightUtils'
import type { EditablePatternProps } from './types'

/**
 * Ref handle for EditablePattern
 */
export interface EditablePatternRef {
  /** Insert text at current cursor position */
  insertAtCursor: (text: string) => void
  /** Focus the textarea */
  focus: () => void
}

/**
 * EditablePattern with textarea + overlay for syntax highlighting
 */
export const EditablePattern = memo(
  forwardRef<EditablePatternRef, EditablePatternProps>(function EditablePattern(
    { value, onChange, placeholder, minHeight = 250, id, suggestions = [], tableMap, templateMap, sharedVariables },
    ref
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)
    const [textareaHeight, setTextareaHeight] = useState<number>(minHeight)

    // Autocomplete hook - only active when suggestions are provided
    const autocomplete = usePatternAutocomplete({
      textareaRef,
      suggestions,
      value,
      onValueChange: onChange,
      tableMap,
      templateMap,
      sharedVariables,
    })

    /**
     * Sync scroll position between textarea and overlay
     */
    const syncScroll = useCallback(() => {
      if (textareaRef.current && overlayRef.current) {
        overlayRef.current.scrollTop = textareaRef.current.scrollTop
        overlayRef.current.scrollLeft = textareaRef.current.scrollLeft
      }
    }, [])

    /**
     * Sync textarea dimensions to overlay
     */
    const syncDimensions = useCallback(() => {
      if (textareaRef.current) {
        setTextareaHeight(textareaRef.current.offsetHeight)
      }
    }, [])

    /**
     * Handle textarea input
     */
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value)
        // Sync dimensions after content change
        requestAnimationFrame(syncDimensions)
        // Trigger autocomplete detection
        autocomplete.handleInput()
      },
      [onChange, syncDimensions, autocomplete]
    )

    /**
     * Handle keyboard events - pass through autocomplete first
     */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        autocomplete.handleKeyDown(e)
      },
      [autocomplete]
    )

    /**
     * Insert text at cursor position
     */
    const insertAtCursor = useCallback(
      (text: string) => {
        const textarea = textareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = value.slice(0, start) + text + value.slice(end)

        onChange(newValue)

        // Restore cursor position after the inserted text
        requestAnimationFrame(() => {
          textarea.focus()
          textarea.setSelectionRange(start + text.length, start + text.length)
        })
      },
      [value, onChange]
    )

    /**
     * Focus the textarea
     */
    const focus = useCallback(() => {
      textareaRef.current?.focus()
    }, [])

    /**
     * Expose methods via ref
     */
    useImperativeHandle(
      ref,
      () => ({
        insertAtCursor,
        focus,
      }),
      [insertAtCursor, focus]
    )

    /**
     * Set up ResizeObserver to track textarea size changes (e.g., user resizing)
     */
    useEffect(() => {
      const textarea = textareaRef.current
      if (!textarea) return

      // Initial sync
      syncDimensions()

      const resizeObserver = new ResizeObserver(() => {
        syncDimensions()
        syncScroll()
      })

      resizeObserver.observe(textarea)

      return () => {
        resizeObserver.disconnect()
      }
    }, [syncDimensions, syncScroll])

    /**
     * Sync scroll on value change
     */
    useEffect(() => {
      syncScroll()
    }, [value, syncScroll])

    return (
      <div className="relative font-mono text-sm">
        {/* Syntax-highlighted overlay (visual only) */}
        <div
          ref={overlayRef}
          className={cn(
            'absolute top-0 left-0 right-0 whitespace-pre-wrap break-words',
            'p-3 border border-transparent rounded-md',
            'pointer-events-none overflow-hidden',
            'leading-normal',
            'text-foreground'
          )}
          style={{ height: `${textareaHeight}px` }}
          aria-hidden="true"
        >
          {value ? (
            renderHighlightedText(value)
          ) : (
            <span className="text-muted-foreground/50">{placeholder}</span>
          )}
        </div>

        {/* Actual textarea (handles editing) */}
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          placeholder="" // Placeholder shown in overlay
          className={cn(
            'relative w-full resize-y bg-transparent',
            'outline-none border rounded-md p-3',
            'border-input focus:border-ring focus:ring-1 focus:ring-ring',
            'leading-normal',
            // Transparent text but visible caret
            'editable-pattern-textarea'
          )}
          style={{
            minHeight: `${minHeight}px`,
            color: 'transparent',
            caretColor: 'hsl(var(--foreground))',
          }}
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

export default EditablePattern
