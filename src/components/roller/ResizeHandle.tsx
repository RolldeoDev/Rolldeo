/**
 * ResizeHandle Component
 *
 * A draggable divider for resizing split panels.
 * Provides visual feedback on hover and during drag.
 */

import { memo } from 'react'

interface ResizeHandleProps {
  /** Mouse down handler to start resize */
  onMouseDown: (e: React.MouseEvent) => void
  /** Whether currently resizing */
  isResizing: boolean
}

export const ResizeHandle = memo(function ResizeHandle({
  onMouseDown,
  isResizing,
}: ResizeHandleProps) {
  return (
    <div
      className={`
        relative w-1.5 cursor-col-resize flex-shrink-0
        transition-colors duration-150
        ${isResizing ? 'bg-primary/40' : 'bg-transparent hover:bg-primary/20'}
      `}
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      tabIndex={0}
      onKeyDown={(e) => {
        // Allow keyboard navigation for accessibility
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          // Keyboard resize could be implemented here if needed
        }
      }}
    >
      {/* Visual indicator line */}
      <div
        className={`
          absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-0.5 h-8 rounded-full
          transition-all duration-150
          ${isResizing ? 'bg-primary h-16' : 'bg-white/20'}
        `}
      />
    </div>
  )
})

export default ResizeHandle
