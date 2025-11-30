/**
 * BrowserTabs Component
 *
 * Tab switcher for Tables and Templates in the browser panel.
 */

import { memo } from 'react'
import { Table2, FileText } from 'lucide-react'
import type { BrowserTab } from '@/stores/uiStore'

interface BrowserTabsProps {
  activeTab: BrowserTab
  onTabChange: (tab: BrowserTab) => void
  tableCount: number
  templateCount: number
}

export const BrowserTabs = memo(function BrowserTabs({
  activeTab,
  onTabChange,
  tableCount,
  templateCount,
}: BrowserTabsProps) {
  return (
    <div className="flex border-b border-white/5" role="tablist">
      <button
        className={`
          flex-1 flex items-center justify-center gap-2 px-4 py-2.5
          text-sm font-medium transition-colors duration-150
          border-b-2 -mb-px
          ${
            activeTab === 'tables'
              ? 'text-foreground border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground/80 hover:bg-white/5'
          }
        `}
        onClick={() => onTabChange('tables')}
        role="tab"
        aria-selected={activeTab === 'tables'}
        aria-controls="tables-panel"
      >
        <Table2 className="w-4 h-4" />
        <span>Tables</span>
        <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">
          {tableCount}
        </span>
      </button>
      <button
        className={`
          flex-1 flex items-center justify-center gap-2 px-4 py-2.5
          text-sm font-medium transition-colors duration-150
          border-b-2 -mb-px
          ${
            activeTab === 'templates'
              ? 'text-foreground border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground/80 hover:bg-white/5'
          }
        `}
        onClick={() => onTabChange('templates')}
        role="tab"
        aria-selected={activeTab === 'templates'}
        aria-controls="templates-panel"
      >
        <FileText className="w-4 h-4" />
        <span>Templates</span>
        <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">
          {templateCount}
        </span>
      </button>
    </div>
  )
})

export default BrowserTabs
