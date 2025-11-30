/**
 * EditorHelpButton Component
 *
 * Unobtrusive floating help button that displays syntax quick reference.
 */

import { useState, useCallback, useEffect } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Import the quick reference markdown
import quickReferenceContent from '@/../docs/syntax-quick-reference.md?raw'

export function EditorHelpButton() {
  const [isOpen, setIsOpen] = useState(false)

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false)
    }
  }, [])

  return (
    <>
      {/* Floating Help Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40',
          'w-10 h-10 rounded-full',
          'flex items-center justify-center',
          'text-muted-foreground/50 hover:text-muted-foreground',
          'hover:bg-accent/50',
          'transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
        )}
        aria-label="Syntax quick reference"
        title="Syntax quick reference"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
        >
          <div
            className={cn(
              'relative bg-background border rounded-2xl shadow-lg',
              'w-full max-w-2xl max-h-[80vh]',
              'mx-4 flex flex-col',
              'animate-slide-up'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 id="help-modal-title" className="text-lg font-semibold">
                Quick Reference
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className={cn(
                  'p-2 rounded-lg',
                  'text-muted-foreground hover:text-foreground',
                  'hover:bg-accent',
                  'transition-colors'
                )}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="prose-help">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Skip the h1 since we have our own header
                    h1: () => null,
                    // Style h2 as section headers
                    h2: ({ children }) => (
                      <h2 className="text-base font-semibold mt-6 mb-3 first:mt-0 text-foreground">
                        {children}
                      </h2>
                    ),
                    // Style h3 as sub-headers
                    h3: ({ children }) => (
                      <h3 className="text-sm font-medium mt-4 mb-2 text-foreground">
                        {children}
                      </h3>
                    ),
                    // Style tables
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-3">
                        <table className="w-full border-collapse text-sm">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="border-b border-border bg-muted/50">
                        {children}
                      </thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-3 py-2 text-left font-medium text-xs">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-3 py-2 border-b border-border/50 text-muted-foreground">
                        {children}
                      </td>
                    ),
                    // Style inline code
                    code: ({ className, children, ...props }) => {
                      const isInline = !className
                      if (isInline) {
                        return (
                          <code
                            className="rounded bg-muted px-1 py-0.5 text-xs font-mono text-primary"
                            {...props}
                          >
                            {children}
                          </code>
                        )
                      }
                      return (
                        <code className={cn(className, 'text-xs')} {...props}>
                          {children}
                        </code>
                      )
                    },
                    // Style code blocks
                    pre: ({ children }) => (
                      <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs my-3">
                        {children}
                      </pre>
                    ),
                    // Style paragraphs
                    p: ({ children }) => (
                      <p className="text-sm text-muted-foreground my-2">{children}</p>
                    ),
                    // Style lists
                    ul: ({ children }) => (
                      <ul className="list-disc pl-4 space-y-1 my-2 text-sm text-muted-foreground">
                        {children}
                      </ul>
                    ),
                    // Style emphasis
                    em: ({ children }) => (
                      <em className="text-muted-foreground not-italic text-xs">
                        {children}
                      </em>
                    ),
                  }}
                >
                  {quickReferenceContent}
                </ReactMarkdown>
              </div>
            </div>

            {/* Footer hint */}
            <div className="px-6 py-3 border-t text-xs text-muted-foreground text-center">
              Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">Esc</kbd> or click outside to close
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default EditorHelpButton
