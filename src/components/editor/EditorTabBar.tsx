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

// Tab-specific underline colors (using project's custom color system)
const tabUnderlineColors: Record<EditorTab, string> = {
  metadata: 'bg-amber',
  tables: 'bg-mint',
  templates: 'bg-lavender',
  variables: 'bg-rose',
  json: 'bg-gray-400 dark:bg-white',
}

// Tab-specific icon colors to match underlines
const tabIconColors: Record<EditorTab, string> = {
  metadata: 'text-amber',
  tables: 'text-mint',
  templates: 'text-lavender',
  variables: 'text-rose',
  json: 'text-gray-400 dark:text-white',
}

// Tab-specific badge colors (background with matching text)
const tabBadgeColors: Record<EditorTab, { active: string; hover: string }> = {
  metadata: { active: 'bg-amber/15 text-amber', hover: 'group-hover:bg-amber/10 group-hover:text-amber' },
  tables: { active: 'bg-mint/15 text-mint', hover: 'group-hover:bg-mint/10 group-hover:text-mint' },
  templates: { active: 'bg-lavender/15 text-lavender', hover: 'group-hover:bg-lavender/10 group-hover:text-lavender' },
  variables: { active: 'bg-rose/15 text-rose', hover: 'group-hover:bg-rose/10 group-hover:text-rose' },
  json: { active: 'bg-gray-400/15 text-gray-500', hover: 'group-hover:bg-gray-400/10 group-hover:text-gray-500' },
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
                isActive ? tabIconColors[tab.id] : 'text-muted-foreground group-hover:text-foreground'
              )} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  'px-1.5 py-0.5 text-xs rounded-full transition-colors',
                  isActive
                    ? tabBadgeColors[tab.id].active
                    : `bg-muted text-muted-foreground ${tabBadgeColors[tab.id].hover}`
                )}>
                  {tab.count}
                </span>
              )}

              {/* Active indicator line */}
              {isActive && (
                <span className={cn(
                  'absolute bottom-0 left-2 right-2 h-0.5 rounded-full',
                  tabUnderlineColors[tab.id]
                )} />
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
                isActive ? tabIconColors[tab.id] : 'text-muted-foreground'
              )} />
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  'px-1.5 py-0.5 text-xs rounded-full transition-colors',
                  isActive
                    ? tabBadgeColors[tab.id].active
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
