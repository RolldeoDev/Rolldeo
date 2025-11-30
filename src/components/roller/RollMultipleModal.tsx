/**
 * RollMultipleModal Component
 *
 * Modal for rolling on a table/template multiple times.
 * Displays results in a scrollable list with copy functionality.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Hash, Loader2, ClipboardCopy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BrowserItem } from '@/hooks/useBrowserFilter'

interface RollMultipleModalProps {
  item: BrowserItem
  collectionId: string
  onClose: () => void
  onRoll: (count: number) => Promise<string[]>
}

export function RollMultipleModal({
  item,
  onClose,
  onRoll,
}: RollMultipleModalProps) {
  const [count, setCount] = useState(5)
  const [isRolling, setIsRolling] = useState(false)
  const [results, setResults] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleRoll = useCallback(async () => {
    if (isRolling || count < 1) return

    setIsRolling(true)
    setResults([])

    try {
      const rollResults = await onRoll(count)
      setResults(rollResults)
    } finally {
      setIsRolling(false)
    }
  }, [count, isRolling, onRoll])

  const handleCopyAll = useCallback(async () => {
    if (results.length === 0) return

    try {
      await navigator.clipboard.writeText(results.join('\n\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [results])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isRolling) {
      handleRoll()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-background border border-border rounded-lg shadow-xl',
          'w-full max-w-lg mx-4 max-h-[80vh] flex flex-col',
          'animate-fade-in'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Roll Multiple</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-auto">
          <p className="text-sm text-muted-foreground mb-4">
            Roll on <span className="font-medium text-foreground">{item.name}</span> multiple times.
          </p>

          {/* Count Input */}
          <div className="flex items-center gap-3 mb-4">
            <label htmlFor="roll-count" className="text-sm font-medium">
              Number of rolls:
            </label>
            <input
              ref={inputRef}
              id="roll-count"
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-20 px-3 py-1.5 rounded-md border border-border bg-background',
                'text-sm text-center',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
              )}
            />
            <button
              onClick={handleRoll}
              disabled={isRolling || count < 1}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center gap-2'
              )}
            >
              {isRolling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Rolling...
                </>
              ) : (
                'Roll'
              )}
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {results.length} results
                </span>
                <button
                  onClick={handleCopyAll}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
                    'hover:bg-accent transition-colors',
                    copied ? 'text-green-500' : 'text-muted-foreground'
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-3.5 h-3.5" />
                      Copy All
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-auto">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-md bg-muted/50 border border-border/50',
                      'text-sm'
                    )}
                  >
                    <span className="text-xs text-muted-foreground mr-2">
                      {index + 1}.
                    </span>
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm',
              'hover:bg-accent transition-colors'
            )}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default RollMultipleModal
