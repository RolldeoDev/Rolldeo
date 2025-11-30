/**
 * EditablePattern Component
 *
 * Editable pattern area using textarea + overlay technique.
 * - Textarea handles all editing natively (cursor, selection, undo/redo, IME)
 * - Transparent textarea text with visible caret
 * - Overlay div shows syntax-highlighted version
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
import type { EditablePatternProps } from './types'

/**
 * Get expression class name based on content
 */
function getExpressionClassName(content: string): string {
  if (content.startsWith('dice:')) {
    return 'text-purple-600 dark:text-purple-400'
  }
  if (content.startsWith('math:')) {
    return 'text-green-600 dark:text-green-400'
  }
  if (content.startsWith('collect:')) {
    return 'text-emerald-600 dark:text-emerald-400'
  }
  if (content.includes(' >> $') || content.includes('>>$')) {
    return 'text-rose-600 dark:text-rose-400'
  }
  if (content.startsWith('$')) {
    return 'text-orange-600 dark:text-orange-400'
  }
  if (content.startsWith('@')) {
    return 'text-pink-600 dark:text-pink-400'
  }
  if (content === 'again' || content.endsWith('*again')) {
    return 'text-cyan-600 dark:text-cyan-400'
  }
  if (content.startsWith('unique:')) {
    return 'text-yellow-600 dark:text-yellow-400'
  }
  // Default for table references
  return 'text-blue-600 dark:text-blue-400'
}

/**
 * Render syntax-highlighted pattern for overlay
 */
function renderHighlightedPattern(pattern: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  const regex = /\{\{([^}]+)\}\}/g
  let match

  while ((match = regex.exec(pattern)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {pattern.slice(lastIndex, match.index)}
        </span>
      )
    }

    // Add the highlighted match
    const content = match[1]
    const className = getExpressionClassName(content)

    parts.push(
      <span key={`expr-${match.index}`} className={className}>
        {match[0]}
      </span>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < pattern.length) {
    parts.push(
      <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
        {pattern.slice(lastIndex)}
      </span>
    )
  }

  return parts.length > 0 ? parts : pattern
}

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
    { value, onChange, placeholder, minHeight = 120, id },
    ref
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)
    const [textareaHeight, setTextareaHeight] = useState<number>(minHeight)

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
      },
      [onChange, syncDimensions]
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
            'leading-normal'
          )}
          style={{ height: `${textareaHeight}px` }}
          aria-hidden="true"
        >
          {value ? (
            renderHighlightedPattern(value)
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
      </div>
    )
  })
)

export default EditablePattern
