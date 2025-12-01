/**
 * ResultTypeSelector Component
 *
 * A combobox-style selector for resultType that shows predefined options
 * while allowing free text entry for custom types. Displays the corresponding
 * icon for the current value.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Search, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  RESULT_TYPE_OPTIONS,
  RESULT_TYPE_ICONS,
  getResultTypeIcon,
} from '@/lib/resultTypeIcons'

interface ResultTypeSelectorProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
  placeholder?: string
}

export function ResultTypeSelector({
  value,
  onChange,
  placeholder = 'Select or enter type...',
}: ResultTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  // Filter options by search
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return RESULT_TYPE_OPTIONS
    const query = search.toLowerCase()
    return RESULT_TYPE_OPTIONS.filter(
      (option) =>
        option.value.toLowerCase().includes(query) ||
        option.label.toLowerCase().includes(query) ||
        option.description.toLowerCase().includes(query)
    )
  }, [search])

  // Get the icon for the current value
  const CurrentIcon = getResultTypeIcon(value)

  // Update position when opening
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [isOpen])

  // Reset highlighted index when filtering
  useEffect(() => {
    setHighlightedIndex(0)
  }, [search])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setSearch('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (!isOpen) {
            setIsOpen(true)
          } else {
            setHighlightedIndex((i) => Math.min(i + 1, filteredOptions.length - 1))
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (isOpen && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex].value)
          }
          break
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          setSearch('')
          break
        case 'Tab':
          setIsOpen(false)
          setSearch('')
          break
      }
    },
    [isOpen, filteredOptions, highlightedIndex]
  )

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue || undefined)
      setIsOpen(false)
      setSearch('')
    },
    [onChange]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearch(newValue)
    onChange(newValue || undefined)
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleFocus = () => {
    setIsOpen(true)
    setSearch(value || '')
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : value || ''}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full px-3 py-2 pr-16 text-sm rounded-lg border bg-background transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 border-border/50 focus:border-primary',
            'md:rounded-md md:text-sm'
          )}
        />
        {/* Result type icon - right side, inside input */}
        <div
          className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none"
          title={value ? `Type: ${value}` : undefined}
        >
          <CurrentIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        {/* Chevron dropdown button */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen)
            if (!isOpen) {
              setSearch(value || '')
              inputRef.current?.focus()
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-accent rounded transition-colors"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 bg-popover border border-border/50 rounded-xl shadow-xl overflow-hidden animate-fade-in"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: Math.max(dropdownPosition.width, 280),
            }}
          >
            {/* Search hint */}
            <div className="px-3 py-2 border-b border-border/30 bg-muted/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Search className="h-3 w-3" />
                <span>Type to search or enter custom value</span>
              </div>
            </div>

            {/* Options */}
            <div className="max-h-64 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {search.trim()
                    ? `No matching types. "${search}" will be used as custom type.`
                    : 'No options available'}
                </div>
              ) : (
                filteredOptions.map((option, index) => {
                  const OptionIcon = RESULT_TYPE_ICONS[option.value] || CurrentIcon
                  const isSelected = value?.toLowerCase() === option.value.toLowerCase()

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
                        index === highlightedIndex
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-accent/50'
                      )}
                      onClick={() => handleSelect(option.value)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <OptionIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {option.description}
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                    </button>
                  )
                })
              )}
            </div>

            {/* Keyboard hints */}
            <div className="px-3 py-2 border-t border-border/30 bg-muted/30">
              <p className="text-xs text-muted-foreground/70">
                <kbd className="px-1 py-0.5 bg-background rounded text-[10px]">↑↓</kbd> navigate
                <span className="mx-2">·</span>
                <kbd className="px-1 py-0.5 bg-background rounded text-[10px]">Enter</kbd> select
                <span className="mx-2">·</span>
                <kbd className="px-1 py-0.5 bg-background rounded text-[10px]">Esc</kbd> close
              </p>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default ResultTypeSelector
