/**
 * ThemeSwitcher Component
 *
 * Elegant theme toggle with smooth transitions between light and dark modes.
 * Features animated sun/moon icons with a warm, tactile feel.
 */

import { memo, useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useUIStore, applyTheme } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

export const ThemeSwitcher = memo(function ThemeSwitcher() {
  const theme = useUIStore((state) => state.theme)
  const setTheme = useUIStore((state) => state.setTheme)

  // Apply theme when it changes
  useEffect(() => {
    applyTheme(theme)

    // Also listen for system preference changes when in system mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('system')
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [theme])

  // Cycle through themes: light -> dark -> system -> light
  const cycleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(nextTheme)
  }

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />
      case 'dark':
        return <Moon className="h-4 w-4" />
      case 'system':
        return <Monitor className="h-4 w-4" />
    }
  }

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light'
      case 'dark':
        return 'Dark'
      case 'system':
        return 'Auto'
    }
  }

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300",
        "bg-secondary/50 hover:bg-secondary border border-border/50",
        "text-muted-foreground hover:text-foreground",
        "active:scale-95"
      )}
      aria-label={`Current theme: ${theme}. Click to change.`}
      title={`Theme: ${getLabel()}`}
    >
      <span className="transition-transform duration-300 ease-out">
        {getIcon()}
      </span>
      <span className="hidden sm:inline text-xs">{getLabel()}</span>
    </button>
  )
})

export default ThemeSwitcher
