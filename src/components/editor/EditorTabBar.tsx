/**
 * EditorTabBar Component
 *
 * Tab navigation for the editor workspace with badge counts.
 */

import { cn } from '@/lib/utils'
import { FileJson, Table2, Sparkles, Variable, Code } from 'lucide-react'

export type EditorTab = 'metadata' | 'tables' | 'templates' | 'variables' | 'json'

interface TabConfig {
  id: EditorTab
  label: string
  icon: typeof FileJson
  count?: number
}

interface EditorTabBarProps {
  activeTab: EditorTab
  onTabChange: (tab: EditorTab) => void
  tableCounts: {
    tables: number
    templates: number
  }
}

export function EditorTabBar({ activeTab, onTabChange, tableCounts }: EditorTabBarProps) {
  const tabs: TabConfig[] = [
    { id: 'metadata', label: 'Metadata', icon: FileJson },
    { id: 'tables', label: 'Tables', icon: Table2, count: tableCounts.tables },
    { id: 'templates', label: 'Templates', icon: Sparkles, count: tableCounts.templates },
    { id: 'variables', label: 'Variables', icon: Variable },
    { id: 'json', label: 'JSON', icon: Code },
  ]

  return (
    <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      {/* Desktop tab bar */}
      <nav className="hidden md:flex gap-1 px-2 pt-2" aria-label="Editor tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all duration-200',
                isActive
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
              aria-selected={isActive}
              role="tab"
            >
              <Icon className={cn(
                'h-4 w-4 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  'px-1.5 py-0.5 text-xs rounded-full transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                )}>
                  {tab.count}
                </span>
              )}

              {/* Active indicator line */}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Mobile tab bar - horizontally scrollable */}
      <nav
        className="flex md:hidden overflow-x-auto gap-1 px-2 py-2"
        aria-label="Editor tabs"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'group relative flex-shrink-0 flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200',
                'min-h-[44px]',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground active:bg-accent'
              )}
              aria-selected={isActive}
              role="tab"
              style={{ scrollSnapAlign: 'center' }}
            >
              <Icon className={cn(
                'h-4 w-4 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )} />
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  'px-1.5 py-0.5 text-xs rounded-full transition-colors',
                  isActive
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default EditorTabBar
