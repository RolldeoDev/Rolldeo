/**
 * GuideLayout Component
 *
 * Shared layout for guide pages with sidebar navigation and breadcrumbs.
 */

import { useState, useMemo, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Menu, X } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { GuideSidebar } from './GuideSidebar'
import { guideSections } from './guideSections'
import { MarkdownRenderer } from './MarkdownRenderer'
import { extractHeadings } from '@/lib/guideMarkdown'

interface GuideLayoutProps {
  /** Page title for breadcrumb */
  title: string
  /** Markdown content to render */
  content: string
  /** Additional content after markdown (for schema page) */
  children?: React.ReactNode
}

export function GuideLayout({ title, content, children }: GuideLayoutProps) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false)
    }
    window.addEventListener('resize', closeOnDesktop)
    return () => window.removeEventListener('resize', closeOnDesktop)
  }, [])
  useEffect(() => setSidebarOpen(false), [location.pathname])

  // Extract headings for table of contents
  const headings = useMemo(() => extractHeadings(content), [content])

  // Get current section info
  const currentSection = guideSections.find(
    (s) => location.pathname === s.path
  )

  return (
    <div className="relative">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-20 right-4 z-50 md:hidden p-3 rounded-full bg-primary text-primary-foreground shadow-lg"
        aria-label="Toggle table of contents"
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile sidebar */}
      {sidebarOpen && <Modal
        onClose={() => setSidebarOpen(false)}
        aria-label="Guide navigation"
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 bg-background text-foreground p-6 border-0 backdrop:bg-black/50"
      >
        <button onClick={() => setSidebarOpen(false)} aria-label="Close guide navigation"
          className="mb-4 p-2 rounded-lg hover:bg-accent"><X className="h-5 w-5" /></button>
        <GuideSidebar headings={headings} onNavigate={() => setSidebarOpen(false)} />
      </Modal>}

      {/* Main content */}
      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-56 flex-shrink-0">
          <GuideSidebar headings={headings} />
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link
              to="/guide"
              className="hover:text-foreground transition-colors"
            >
              Guide
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{title}</span>
          </nav>

          {/* Page header */}
          {currentSection && (
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">{currentSection.label}</h1>
              <p className="text-lg text-muted-foreground">
                {currentSection.description}
              </p>
            </div>
          )}

          {/* Markdown content */}
          <MarkdownRenderer content={content} />

          {/* Additional content (for schema page) */}
          {children}

          {/* Navigation footer */}
          <NavigationFooter />
        </div>
      </div>
    </div>
  )
}

function NavigationFooter() {
  const location = useLocation()
  const currentIndex = guideSections.findIndex(
    (s) => s.path === location.pathname
  )
  const prevSection = currentIndex > 0 ? guideSections[currentIndex - 1] : null
  const nextSection =
    currentIndex < guideSections.length - 1
      ? guideSections[currentIndex + 1]
      : null

  if (!prevSection && !nextSection) return null

  return (
    <div className="flex justify-between items-center mt-12 pt-8 border-t border-border">
      {prevSection ? (
        <Link
          to={prevSection.path}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          <div>
            <div className="text-xs uppercase tracking-wide">Previous</div>
            <div className="font-medium">{prevSection.label}</div>
          </div>
        </Link>
      ) : (
        <div />
      )}

      {nextSection && (
        <Link
          to={nextSection.path}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-right"
        >
          <div>
            <div className="text-xs uppercase tracking-wide">Next</div>
            <div className="font-medium">{nextSection.label}</div>
          </div>
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}

export default GuideLayout
