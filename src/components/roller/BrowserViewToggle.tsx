/**
 * BrowserViewToggle Component
 *
 * Toggle between flat and grouped view modes with group-by dropdown.
 */

import { memo, useState, useRef, useEffect } from 'react'
import { List, LayoutGrid, ChevronDown } from 'lucide-react'
import type { BrowserViewMode, BrowserGroupBy } from '@/stores/uiStore'

interface BrowserViewToggleProps {
  viewMode: BrowserViewMode
  groupBy: BrowserGroupBy
  onViewModeChange: (mode: BrowserViewMode) => void
  onGroupByChange: (groupBy: BrowserGroupBy) => void
}

const GROUP_BY_OPTIONS: { value: BrowserGroupBy; label: string }[] = [
  { value: 'resultType', label: 'Result Type' },
  { value: 'tag', label: 'Tag' },
  { value: 'alpha', label: 'Alphabetical' },
]

export const BrowserViewToggle = memo(function BrowserViewToggle({
  viewMode,
  groupBy,
  onViewModeChange,
  onGroupByChange,
}: BrowserViewToggleProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleViewModeToggle = () => {
    if (viewMode === 'flat') {
      onViewModeChange('grouped')
      // Default to 'resultType' grouping when switching to grouped mode
      if (!groupBy) {
        onGroupByChange('resultType')
      }
    } else {
      onViewModeChange('flat')
    }
  }

  const handleGroupBySelect = (value: BrowserGroupBy) => {
    onGroupByChange(value)
    setIsDropdownOpen(false)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
      {/* View Mode Toggle */}
      <button
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
          transition-colors duration-150
          ${viewMode === 'flat' ? 'bg-primary/20 text-primary' : 'bg-white/5 text-muted-foreground hover:text-foreground'}
        `}
        onClick={handleViewModeToggle}
        aria-pressed={viewMode === 'flat'}
        title="Flat list"
      >
        <List className="w-3.5 h-3.5" />
        <span>Flat</span>
      </button>

      {/* Grouped Toggle with Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          className={`
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
            transition-colors duration-150
            ${viewMode === 'grouped' ? 'bg-primary/20 text-primary' : 'bg-white/5 text-muted-foreground hover:text-foreground'}
          `}
          onClick={() => {
            if (viewMode === 'grouped') {
              setIsDropdownOpen(!isDropdownOpen)
            } else {
              handleViewModeToggle()
            }
          }}
          aria-pressed={viewMode === 'grouped'}
          aria-haspopup={viewMode === 'grouped' ? 'listbox' : undefined}
          aria-expanded={isDropdownOpen}
          title="Grouped view"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>
            {viewMode === 'grouped' && groupBy
              ? GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label
              : 'Grouped'}
          </span>
          {viewMode === 'grouped' && (
            <ChevronDown className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          )}
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && viewMode === 'grouped' && (
          <div
            className="absolute top-full left-0 mt-1 w-36 py-1 bg-card border border-white/10 rounded-lg shadow-xl z-50"
            role="listbox"
          >
            {GROUP_BY_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`
                  w-full px-3 py-2 text-left text-xs
                  transition-colors duration-150
                  ${groupBy === option.value ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-white/5'}
                `}
                onClick={() => handleGroupBySelect(option.value)}
                role="option"
                aria-selected={groupBy === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

export default BrowserViewToggle
