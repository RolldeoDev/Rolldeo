/**
 * BrowserSearchBar Component
 *
 * Search input for filtering tables/templates in the browser panel.
 */

import { memo } from 'react'
import { Search, X } from 'lucide-react'

interface BrowserSearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export const BrowserSearchBar = memo(function BrowserSearchBar({
  value,
  onChange,
  placeholder = 'Search...',
}: BrowserSearchBarProps) {
  return (
    <div className="relative px-3 py-2">
      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-full pl-8 pr-8 py-2 text-sm
          bg-white/5 border border-white/10 rounded-lg
          text-foreground placeholder:text-muted-foreground
          focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
          transition-colors duration-150
        "
        aria-label="Search tables and templates"
      />
      {value && (
        <button
          className="absolute right-5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/10 transition-colors"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  )
})

export default BrowserSearchBar
