/**
 * MarkdownRenderer Component
 *
 * Renders markdown content with syntax highlighting, GFM support,
 * and custom styling to match the app's design system.
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  /** The markdown content to render */
  content: string
  /** Additional CSS classes */
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn('prose-guide', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeHighlight]}
        components={{
          // Custom heading rendering with anchor links
          h1: ({ children, id }) => (
            <h1 id={id} className="scroll-mt-24 group">
              {children}
              {id && <HeadingAnchor id={id} />}
            </h1>
          ),
          h2: ({ children, id }) => (
            <h2 id={id} className="scroll-mt-24 group">
              {children}
              {id && <HeadingAnchor id={id} />}
            </h2>
          ),
          h3: ({ children, id }) => (
            <h3 id={id} className="scroll-mt-24 group">
              {children}
              {id && <HeadingAnchor id={id} />}
            </h3>
          ),
          // Custom code blocks
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-[#1e1e1e] p-4 text-sm">
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className
            if (isInline) {
              return (
                <code
                  className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-primary"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          // Custom table styling
          table: ({ children }) => (
            <div className="overflow-x-auto my-6">
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
            <th className="px-4 py-3 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 border-b border-border/50">{children}</td>
          ),
          // Custom link styling
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          // Custom blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-4">
              {children}
            </blockquote>
          ),
          // Custom list styling
          ul: ({ children }) => (
            <ul className="list-disc pl-6 space-y-2 my-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 space-y-2 my-4">{children}</ol>
          ),
          // Horizontal rule
          hr: () => <hr className="my-8 border-border" />,
          // Strong/bold
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function HeadingAnchor({ id }: { id: string }) {
  return (
    <a
      href={`#${id}`}
      className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
      aria-label="Link to this section"
    >
      #
    </a>
  )
}

/**
 * Extract headings from markdown for table of contents
 */
export interface Heading {
  id: string
  text: string
  level: number
}

export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = []
  const regex = /^(#{1,3})\s+(.+)$/gm
  let match

  while ((match = regex.exec(markdown)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    // Generate slug ID (same as rehype-slug)
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    headings.push({ id, text, level })
  }

  return headings
}

export default MarkdownRenderer
