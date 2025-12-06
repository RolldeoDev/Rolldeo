/**
 * ResultThemeSwitcher Component
 *
 * Toggle for switching between result display themes on the roller page.
 * Cycles between default (modern) and TTRPG (parchment) styles.
 */

import { memo } from 'react'
import { Scroll, Sparkles } from 'lucide-react'
import { useUIStore, type ResultTheme } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

const themeConfig: Record<ResultTheme, { icon: typeof Scroll; label: string; title: string }> = {
  default: {
    icon: Sparkles,
    label: 'Modern',
    title: 'Modern result style',
  },
  ttrpg: {
    icon: Scroll,
    label: 'TTRPG',
    title: 'Traditional TTRPG parchment style',
  },
}

export const ResultThemeSwitcher = memo(function ResultThemeSwitcher() {
  const resultTheme = useUIStore((state) => state.resultTheme)
  const setResultTheme = useUIStore((state) => state.setResultTheme)

  // Cycle through themes
  const cycleTheme = () => {
    const nextTheme: ResultTheme = resultTheme === 'default' ? 'ttrpg' : 'default'
    setResultTheme(nextTheme)
  }

  const config = themeConfig[resultTheme]
  const Icon = config.icon

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300",
        "bg-secondary/50 hover:bg-secondary border border-border/50",
        "text-muted-foreground hover:text-foreground",
        "active:scale-95"
      )}
      aria-label={`Current result style: ${config.label}. Click to change.`}
      title={config.title}
    >
      <span className="transition-transform duration-300 ease-out">
        <Icon className="h-4 w-4" />
      </span>
      <span className="hidden sm:inline text-xs">{config.label}</span>
    </button>
  )
})
