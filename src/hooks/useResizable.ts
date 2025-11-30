/**
 * useResizable Hook
 *
 * Provides drag-to-resize functionality for split panels.
 * Returns width state and mouse event handlers.
 */

import { useState, useCallback, useEffect, useRef } from 'react'

interface UseResizableOptions {
  /** Initial width in pixels */
  initialWidth: number
  /** Minimum allowed width */
  minWidth: number
  /** Maximum allowed width */
  maxWidth: number
  /** Callback when width changes (for persistence) */
  onWidthChange?: (width: number) => void
  /** Debounce delay for onWidthChange callback (default: 500ms) */
  persistDelay?: number
}

interface UseResizableReturn {
  /** Current width in pixels */
  width: number
  /** Whether currently resizing */
  isResizing: boolean
  /** Attach to resize handle's onMouseDown */
  handleMouseDown: (e: React.MouseEvent) => void
  /** Manually set width */
  setWidth: (width: number) => void
}

export function useResizable({
  initialWidth,
  minWidth,
  maxWidth,
  onWidthChange,
  persistDelay = 500,
}: UseResizableOptions): UseResizableReturn {
  const [width, setWidthState] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)
  const persistTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Clamp width to bounds
  const clampWidth = useCallback(
    (w: number) => Math.min(maxWidth, Math.max(minWidth, w)),
    [minWidth, maxWidth]
  )

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  // Set width with clamping
  const setWidth = useCallback(
    (newWidth: number) => {
      setWidthState(clampWidth(newWidth))
    },
    [clampWidth]
  )

  // Handle mouse move and up events
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      // Use requestAnimationFrame for smooth resizing
      requestAnimationFrame(() => {
        const newWidth = clampWidth(e.clientX)
        setWidthState(newWidth)
      })
    }

    const handleMouseUp = () => {
      setIsResizing(false)

      // Debounced persist callback
      if (onWidthChange) {
        if (persistTimeoutRef.current) {
          clearTimeout(persistTimeoutRef.current)
        }
        persistTimeoutRef.current = setTimeout(() => {
          setWidthState((currentWidth) => {
            onWidthChange(currentWidth)
            return currentWidth
          })
        }, persistDelay)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Add cursor style to body during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, clampWidth, onWidthChange, persistDelay])

  // Cleanup persist timeout on unmount
  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current)
      }
    }
  }, [])

  return {
    width,
    isResizing,
    handleMouseDown,
    setWidth,
  }
}

export default useResizable
