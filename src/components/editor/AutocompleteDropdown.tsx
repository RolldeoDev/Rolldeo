/**
 * AutocompleteDropdown Component
 *
 * Lightweight dropdown for pattern autocomplete, rendered via portal
 * and positioned at the cursor location.
 */

import { memo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { Suggestion, SuggestionColorClass } from '@/hooks/usePatternSuggestions'

/**
 * Props for AutocompleteDropdown
 */
export interface AutocompleteDropdownProps {
  /** Filtered suggestions to display */
  suggestions: Suggestion[]
  /** Currently selected index */
  selectedIndex: number
  /** Position for the dropdown */
  position: { top: number; left: number }
  /** Called when user hovers over an item */
  onSelect: (index: number) => void
  /** Called when user clicks an item */
  onConfirm: (index: number) => void
  /** Called when dropdown should close */
  onClose: () => void
}

/**
 * Get highlight classes based on item color
 */
function getHighlightClasses(
  colorClass: SuggestionColorClass,
  isSelected: boolean
): string {
  if (!isSelected) return 'hover:bg-accent/50'

  switch (colorClass) {
    case 'mint':
      return 'bg-mint/10 text-mint'
    case 'lavender':
      return 'bg-lavender/10 text-lavender'
    case 'amber':
      return 'bg-amber/10 text-amber'
    case 'pink':
      return 'bg-pink/10 text-pink'
    case 'cyan':
      return 'bg-cyan/10 text-cyan'
    default:
      return 'bg-primary/10 text-primary'
  }
}

/**
 * Get icon color class
 */
function getIconColorClass(colorClass: SuggestionColorClass): string {
  switch (colorClass) {
    case 'mint':
      return 'text-mint'
    case 'lavender':
      return 'text-lavender'
    case 'amber':
      return 'text-amber'
    case 'pink':
      return 'text-pink'
    case 'cyan':
      return 'text-cyan'
    default:
      return 'text-muted-foreground'
  }
}

/**
 * Calculate dropdown position to stay within viewport
 */
function calculatePosition(
  position: { top: number; left: number },
  dropdownHeight: number,
  dropdownWidth: number
): { top: number; left: number } {
  const margin = 8
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  let { top, left } = position

  // Flip up if near bottom
  if (top + dropdownHeight > viewportHeight - margin) {
    top = Math.max(margin, top - dropdownHeight - 24) // 24 = line height offset
  }

  // Ensure doesn't go off right edge
  if (left + dropdownWidth > viewportWidth - margin) {
    left = viewportWidth - dropdownWidth - margin
  }

  // Ensure doesn't go off left edge
  left = Math.max(margin, left)

  return { top, left }
}

/**
 * Autocomplete dropdown component
 */
export const AutocompleteDropdown = memo(function AutocompleteDropdown({
  suggestions,
  selectedIndex,
  position,
  onSelect,
  onConfirm,
  onClose,
}: AutocompleteDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLButtonElement>(null)

  // Dropdown dimensions for positioning
  const dropdownWidth = 320
  const maxHeight = 256
  const itemHeight = 48 // approximate item height
  const dropdownHeight = Math.min(suggestions.length * itemHeight + 40, maxHeight)

  const adjustedPosition = calculatePosition(position, dropdownHeight, dropdownWidth)

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }, [selectedIndex])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    // Close on scroll (but not if scrolling within the dropdown itself)
    const handleScroll = (e: Event) => {
      // Don't close if scrolling inside the dropdown
      if (dropdownRef.current?.contains(e.target as Node)) {
        return
      }
      onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose])

  if (suggestions.length === 0) {
    return null
  }

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-50 bg-popover border border-border/50 rounded-lg shadow-xl overflow-hidden animate-fade-in"
      style={{
        top: adjustedPosition.top,
        left: adjustedPosition.left,
        width: dropdownWidth,
        maxHeight,
      }}
    >
      {/* Suggestions list */}
      <div className="overflow-y-auto" style={{ maxHeight: maxHeight - 32 }}>
        {suggestions.map((suggestion, index) => {
          const Icon = suggestion.icon
          const isSelected = index === selectedIndex

          return (
            <button
              key={suggestion.id}
              ref={isSelected ? selectedItemRef : undefined}
              type="button"
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                getHighlightClasses(suggestion.colorClass, isSelected)
              )}
              onClick={() => onConfirm(index)}
              onMouseEnter={() => onSelect(index)}
            >
              <Icon
                className={cn(
                  'h-4 w-4 flex-shrink-0',
                  getIconColorClass(suggestion.colorClass)
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium font-mono text-xs truncate">
                  {suggestion.label}
                </div>
                {suggestion.description && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    {suggestion.description}
                  </div>
                )}
              </div>
              {suggestion.source !== 'Local' && suggestion.source !== 'Syntax' && (
                <span className="text-[10px] text-muted-foreground/60 truncate max-w-[60px]">
                  {suggestion.source}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Keyboard hint */}
      <div className="px-2.5 py-1.5 border-t border-border/30 bg-muted/30">
        <p className="text-[10px] text-muted-foreground/70">
          <kbd className="px-1 py-0.5 bg-background rounded">↑↓</kbd> navigate
          <span className="mx-1.5">·</span>
          <kbd className="px-1 py-0.5 bg-background rounded">Tab</kbd> insert
          <span className="mx-1.5">·</span>
          <kbd className="px-1 py-0.5 bg-background rounded">Esc</kbd> close
        </p>
      </div>
    </div>,
    document.body
  )
})

export default AutocompleteDropdown
