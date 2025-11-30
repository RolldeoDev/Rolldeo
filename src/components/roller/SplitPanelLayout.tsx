/**
 * SplitPanelLayout Component
 *
 * A resizable split-panel layout with left browser panel and right results panel.
 * On mobile (< 768px), the browser panel becomes a slide-out drawer.
 */

import { ReactNode, useEffect, useState, useCallback } from 'react'
import { Menu, X } from 'lucide-react'
import { useResizable } from '@/hooks/useResizable'
import { useUIStore } from '@/stores/uiStore'
import { ResizeHandle } from './ResizeHandle'

interface SplitPanelLayoutProps {
  /** Content for the left browser panel */
  leftPanel: ReactNode
  /** Content for the right results panel */
  rightPanel: ReactNode
}

const MIN_WIDTH = 280
const MAX_WIDTH = 600
const DEFAULT_WIDTH = 380
const MOBILE_BREAKPOINT = 768

export function SplitPanelLayout({
  leftPanel,
  rightPanel,
}: SplitPanelLayoutProps) {
  const storedWidth = useUIStore((state) => state.browserPanelWidth)
  const setBrowserPanelWidth = useUIStore((state) => state.setBrowserPanelWidth)

  const [isMobile, setIsMobile] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const { width, isResizing, handleMouseDown, setWidth } = useResizable({
    initialWidth: storedWidth || DEFAULT_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    onWidthChange: setBrowserPanelWidth,
    persistDelay: 500,
  })

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close drawer when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setIsDrawerOpen(false)
    }
  }, [isMobile])

  // Sync with stored width on mount (in case localStorage has a value)
  useEffect(() => {
    if (storedWidth && storedWidth !== width) {
      setWidth(storedWidth)
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen((prev) => !prev)
  }, [])

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false)
  }, [])

  // Mobile layout with drawer
  if (isMobile) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        {/* Mobile Header with Menu Button */}
        <div className="absolute top-0 left-0 right-0 h-14 bg-card border-b border-border/50 flex items-center px-4 z-20">
          <button
            onClick={toggleDrawer}
            className="p-2 -ml-2 rounded-lg hover:bg-accent transition-colors"
            aria-label={isDrawerOpen ? 'Close browser' : 'Open browser'}
          >
            {isDrawerOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
          <span className="ml-2 font-medium">
            {isDrawerOpen ? 'Browse Tables' : 'Roll'}
          </span>
        </div>

        {/* Backdrop */}
        {isDrawerOpen && (
          <div
            className="absolute inset-0 bg-black/50 z-30 transition-opacity"
            onClick={closeDrawer}
            aria-hidden="true"
          />
        )}

        {/* Drawer */}
        <div
          className={`
            absolute top-0 left-0 h-full w-[85vw] max-w-[400px] bg-card z-40
            transform transition-transform duration-300 ease-out
            ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="h-14 flex items-center justify-between px-4 border-b border-border/50">
            <span className="font-medium">Browse Tables</span>
            <button
              onClick={closeDrawer}
              className="p-2 -mr-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Close browser"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="h-[calc(100%-3.5rem)] overflow-hidden">
            {leftPanel}
          </div>
        </div>

        {/* Main Content */}
        <div className="h-full pt-14 overflow-hidden">
          {rightPanel}
        </div>
      </div>
    )
  }

  // Desktop layout with resizable split panel
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left Browser Panel */}
      <div
        className="flex-shrink-0 flex flex-col bg-card border-r border-border/50 overflow-hidden"
        style={{ width: `${width}px` }}
      >
        {leftPanel}
      </div>

      {/* Resize Handle */}
      <ResizeHandle onMouseDown={handleMouseDown} isResizing={isResizing} />

      {/* Right Results Panel */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {rightPanel}
      </div>
    </div>
  )
}

export default SplitPanelLayout
