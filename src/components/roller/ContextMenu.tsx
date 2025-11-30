/**
 * ContextMenu Component
 *
 * A reusable right-click context menu for the roller browser.
 * Renders via portal to avoid clipping issues with virtualized lists.
 */

import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface ContextMenuItem {
  id: string
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled?: boolean
}

export interface ContextMenuDivider {
  type: 'divider'
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider

interface ContextMenuProps {
  items: ContextMenuEntry[]
  position: { x: number; y: number }
  onClose: () => void
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Adjust position to keep menu in viewport
  const getAdjustedPosition = useCallback(() => {
    const menuWidth = 180
    const menuHeight = items.length * 36 // Approximate
    const padding = 8

    let x = position.x
    let y = position.y

    // Adjust horizontal position
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding
    }

    // Adjust vertical position
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding
    }

    return { x: Math.max(padding, x), y: Math.max(padding, y) }
  }, [position, items.length])

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Use capture phase to catch clicks before they propagate
    window.addEventListener('mousedown', handleClickOutside, true)
    return () => window.removeEventListener('mousedown', handleClickOutside, true)
  }, [onClose])

  // Close on scroll
  useEffect(() => {
    const handleScroll = () => onClose()
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [onClose])

  const adjustedPosition = getAdjustedPosition()

  const handleItemClick = (item: ContextMenuItem) => {
    if (!item.disabled) {
      item.onClick()
      onClose()
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50',
        'min-w-[180px] py-1',
        'bg-popover border border-border rounded-lg shadow-lg',
        'animate-fade-in'
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      role="menu"
      aria-orientation="vertical"
    >
      {items.map((entry, index) => {
        if ('type' in entry && entry.type === 'divider') {
          return (
            <div
              key={`divider-${index}`}
              className="my-1 h-px bg-border"
              role="separator"
            />
          )
        }

        const item = entry as ContextMenuItem
        const Icon = item.icon

        return (
          <button
            key={item.id}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-sm text-left',
              'transition-colors duration-100',
              item.disabled
                ? 'text-muted-foreground/50 cursor-not-allowed'
                : 'hover:bg-accent text-foreground'
            )}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            role="menuitem"
          >
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )
}

export default ContextMenu
