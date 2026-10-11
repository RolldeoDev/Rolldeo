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
  const [width, setWidthState] = useState(() => Math.min(maxWidth, Math.max(minWidth, initialWidth)))
  const [isResizing, setIsResizing] = useState(false)
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const widthRef = useRef(width)
  const dragRef = useRef<{ x: number; width: number } | null>(null)

  // Clamp width to bounds
  const clampWidth = useCallback(
    (w: number) => Math.min(maxWidth, Math.max(minWidth, w)),
    [minWidth, maxWidth]
  )

  const persistWidth = useCallback((nextWidth: number) => {
    if (!onWidthChange) return
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current)
    persistTimeoutRef.current = setTimeout(() => onWidthChange(nextWidth), persistDelay)
  }, [onWidthChange, persistDelay])

  // Set width with clamping
  const setWidth = useCallback(
    (newWidth: number) => {
      const nextWidth = clampWidth(newWidth)
      widthRef.current = nextWidth
      setWidthState(nextWidth)
      if (!dragRef.current) persistWidth(nextWidth)
    },
    [clampWidth, persistWidth]
  )

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragRef.current = { x: e.clientX, width: widthRef.current }
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current)
    setIsResizing(true)
  }, [])

  // Handle mouse move and up events
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (drag) setWidth(drag.width + e.clientX - drag.x)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      dragRef.current = null
      persistWidth(widthRef.current)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Add cursor style to body during resize
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [isResizing, setWidth, persistWidth])

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
