/**
 * SortableItem Component
 *
 * Generic draggable item wrapper using @dnd-kit.
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SortableItemProps {
  id: string
  children: React.ReactNode
  className?: string
  handleClassName?: string
}

export function SortableItem({
  id,
  children,
  className,
  handleClassName,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging && 'z-50 opacity-90 shadow-lg',
        className
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag Handle */}
        <button
          type="button"
          className={cn(
            'flex-shrink-0 p-1.5 mt-2 rounded cursor-grab active:cursor-grabbing',
            'text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/50',
            'transition-colors touch-none',
            handleClassName
          )}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}

export default SortableItem
