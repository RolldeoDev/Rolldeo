/**
 * GuideSidebar Component
 *
 * Table of contents sidebar for guide pages with active section highlighting.
 */

import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Heading } from '@/lib/guideMarkdown'
import { guideSections } from './guideSections'

interface GuideSidebarProps {
  /** Headings for table of contents */
  headings?: Heading[]
  /** Whether sidebar is collapsed (mobile) */
  isCollapsed?: boolean
  /** Callback to toggle collapse */
  onToggleCollapse?: () => void
  onNavigate?: () => void
}

export function GuideSidebar({
  headings = [],
  isCollapsed = false,
  onToggleCollapse: _onToggleCollapse,
  onNavigate,
}: GuideSidebarProps) {
  // Reserved for future mobile toggle functionality
  void _onToggleCollapse

  const location = useLocation()
  const [activeHeading, setActiveHeading] = useState<string>('')

  // Track active heading on scroll
  useEffect(() => {
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id)
          }
        })
      },
      { rootMargin: '-100px 0px -80% 0px' }
    )

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [headings])

  return (
    <aside
      className={cn(
        'sticky top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto',
        'border-r border-border/50 pr-4',
        isCollapsed && 'hidden md:block'
      )}
    >
      {/* Guide Navigation */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Guide</span>
        </div>
        <nav className="space-y-1">
          {guideSections.map((section) => {
            const Icon = section.icon
            const isActive = location.pathname === section.path
            return (
              <Link
                key={section.id}
                to={section.path}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{section.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Table of Contents for current page */}
      {headings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">On this page</span>
          </div>
          <nav className="space-y-1">
            {headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  onNavigate?.()
                  const element = document.getElementById(heading.id)
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' })
                    setActiveHeading(heading.id)
                  }
                }}
                className={cn(
                  'block py-1.5 text-sm transition-colors',
                  heading.level === 1 && 'pl-0 font-medium',
                  heading.level === 2 && 'pl-3',
                  heading.level === 3 && 'pl-6 text-xs',
                  activeHeading === heading.id
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {heading.text}
              </a>
            ))}
          </nav>
        </div>
      )}
    </aside>
  )
}

export default GuideSidebar
