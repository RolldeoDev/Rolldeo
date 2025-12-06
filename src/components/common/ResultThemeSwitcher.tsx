/**
 * ResultThemeSwitcher Component
 *
 * Dropdown for selecting the result display theme on the roller page.
 * Supports multiple themes with easy extension.
 */

import { memo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Scroll, Sparkles, Zap, Gem, Palette, ChevronDown, Check, type LucideIcon } from 'lucide-react'
import { useUIStore, type ResultTheme, RESULT_THEMES } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

// Theme configuration - add new themes here
// Each theme needs: icon, label, description
// Also add corresponding CSS classes in index.css:
//   - card-result-{id}
//   - history-item-{id}
//   - prose-roll-{id}
interface ThemeConfig {
  icon: LucideIcon
  label: string
  description: string
}

const themeConfig: Record<ResultTheme, ThemeConfig> = {
  default: {
    icon: Sparkles,
    label: 'Modern',
    description: 'Clean, minimal design',
  },
  ttrpg: {
    icon: Scroll,
    label: 'TTRPG',
    description: 'Classic parchment style',
  },
  cyberpunk: {
    icon: Zap,
    label: 'Cyberpunk',
    description: 'Neon-drenched future tech',
  },
  sleek: {
    icon: Gem,
    label: 'Sleek',
    description: 'Refined editorial elegance',
  },
  whimsical: {
    icon: Palette,
    label: 'Whimsical',
    description: 'Playful colors & joy',
  },
}

export const ResultThemeSwitcher = memo(function ResultThemeSwitcher() {
  const resultTheme = useUIStore((state) => state.resultTheme)
  const setResultTheme = useUIStore((state) => state.setResultTheme)
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const config = themeConfig[resultTheme]
  const Icon = config.icon

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      })
    }
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleSelect = (theme: ResultTheme) => {
    setResultTheme(theme)
    setIsOpen(false)
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300',
          'bg-secondary/50 hover:bg-secondary border border-border/50',
          'text-muted-foreground hover:text-foreground',
          'active:scale-95'
        )}
        aria-label={`Result style: ${config.label}. Click to change.`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="transition-transform duration-300 ease-out">
          <Icon className="h-4 w-4" />
        </span>
        <span className="hidden sm:inline text-xs">{config.label}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="Select result theme"
            className="fixed z-50 bg-popover border border-border/50 rounded-xl shadow-xl overflow-hidden animate-fade-in min-w-[180px]"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
          >
            <div className="py-1">
              {RESULT_THEMES.map((themeId) => {
                const theme = themeConfig[themeId]
                const ThemeIcon = theme.icon
                const isSelected = resultTheme === themeId

                return (
                  <button
                    key={themeId}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(themeId)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-accent/50 text-foreground'
                    )}
                  >
                    <ThemeIcon className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{theme.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {theme.description}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  )
})
