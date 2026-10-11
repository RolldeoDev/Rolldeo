/**
 * DownloadButton Component
 *
 * Button to download spec files (markdown and JSON schema).
 */

import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DownloadButtonProps {
  /** File name for download */
  filename: string
  /** File content to download */
  content: string
  /** MIME type */
  mimeType: string
  /** Button label */
  label: string
  /** Button variant */
  variant?: 'primary' | 'secondary'
  /** Additional className */
  className?: string
}

export function DownloadButton({
  filename,
  content,
  mimeType,
  label,
  variant = 'secondary',
  className,
}: DownloadButtonProps) {
  const handleDownload = () => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleDownload}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border border-border hover:bg-accent',
        className
      )}
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  )
}

export default DownloadButton
