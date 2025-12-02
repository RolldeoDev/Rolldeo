/**
 * DropZone Component
 *
 * Drag-and-drop file upload with click fallback.
 * Accepts JSON and ZIP files for importing table collections.
 */

import { useCallback, useState, useRef } from 'react'
import { FileJson, FileArchive, CloudUpload } from 'lucide-react'
import { cn } from '../../lib/utils'
import { isSupportedFile } from '../../services/import'

interface DropZoneProps {
  /** Called when files are selected */
  onFilesSelected: (files: File[]) => void
  /** Accepted file extensions */
  accept?: string[]
  /** Additional CSS classes */
  className?: string
  /** Whether the dropzone is disabled */
  disabled?: boolean
  /** Custom content */
  children?: React.ReactNode
  /** Compact variant for inline/secondary placement */
  variant?: 'default' | 'compact'
}

export function DropZone({
  onFilesSelected,
  accept = ['.json', '.zip'],
  className,
  disabled = false,
  children,
  variant = 'default',
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) {
        setIsDragOver(true)
      }
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      if (disabled) return

      const files = Array.from(e.dataTransfer.files).filter(isSupportedFile)

      if (files.length > 0) {
        onFilesSelected(files)
      }
    },
    [disabled, onFilesSelected]
  )

  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click()
    }
  }, [disabled])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter(isSupportedFile)

      if (files.length > 0) {
        onFilesSelected(files)
      }

      // Reset input so same file can be selected again
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    },
    [onFilesSelected]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick]
  )

  const isCompact = variant === 'compact'

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Drop files or click to browse"
      aria-disabled={disabled}
      className={cn(
        'relative card-elevated rounded-2xl text-center transition-all duration-300',
        'border-2 border-dashed',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
        disabled
          ? 'cursor-not-allowed opacity-50 border-white/10'
          : 'cursor-pointer border-white/10 hover:border-primary/50 hover:bg-primary/5',
        isDragOver && !disabled && 'border-primary bg-primary/10 scale-[1.01]',
        isCompact ? 'p-4' : 'p-10',
        className
      )}
    >
      {/* Animated background gradient */}
      <div
        className={cn(
          'absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300',
          'bg-gradient-to-br from-primary/10 via-transparent to-lavender/10',
          isDragOver && 'opacity-100'
        )}
      />

      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        multiple
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {children || (
        isCompact ? (
          <div className="relative flex items-center justify-center gap-3">
            <div
              className={cn(
                'icon-container icon-mint transition-transform duration-300',
                isDragOver && 'scale-110'
              )}
            >
              <CloudUpload className="h-4 w-4" />
            </div>
            <p className="text-sm text-muted-foreground">
              {isDragOver ? (
                <span className="text-foreground font-medium">Drop files here</span>
              ) : (
                <>
                  Drop <span className="text-lavender font-medium">.json</span> or{' '}
                  <span className="text-amber font-medium">.zip</span> files to import
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="relative flex flex-col items-center gap-5">
            {/* Icon group */}
            <div className="flex items-center gap-3">
              <div className="icon-container icon-lavender">
                <FileJson className="h-5 w-5" />
              </div>
              <div
                className={cn(
                  'icon-container icon-mint p-4 transition-transform duration-300',
                  isDragOver && 'scale-110'
                )}
              >
                <CloudUpload className="h-7 w-7" />
              </div>
              <div className="icon-container icon-amber">
                <FileArchive className="h-5 w-5" />
              </div>
            </div>

            {/* Text */}
            <div className="space-y-2">
              <p className="text-foreground font-semibold text-lg">
                {isDragOver ? 'Drop files here' : 'Drop files here or click to browse'}
              </p>
              <p className="text-sm text-muted-foreground">
                Accepts <span className="text-lavender font-medium">JSON</span> and{' '}
                <span className="text-amber font-medium">ZIP</span> files
              </p>
            </div>

            {/* Pill hint */}
            <div className="flex gap-2">
              <span className="pill pill-lavender">
                <FileJson className="h-3 w-3 mr-1.5 inline" />
                .json
              </span>
              <span className="pill pill-amber">
                <FileArchive className="h-3 w-3 mr-1.5 inline" />
                .zip
              </span>
            </div>
          </div>
        )
      )}
    </div>
  )
}
