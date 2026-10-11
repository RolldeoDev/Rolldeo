/**
 * SortableList Component
 *
 * Generic drag-drop list wrapper using @dnd-kit.
 */

import { useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

interface SortableListProps<T> {
  items: T[]
  getItemId: (item: T) => string
  onReorder: (items: T[]) => void
  children: React.ReactNode
}

export function SortableList<T>({
  items,
  getItemId,
  onReorder,
  children,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const oldIndex = items.findIndex((item) => getItemId(item) === active.id)
        const newIndex = items.findIndex((item) => getItemId(item) === over.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          onReorder(arrayMove(items, oldIndex, newIndex))
        }
      }
    },
    [items, getItemId, onReorder]
  )

  const itemIds = items.map(getItemId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

export default SortableList
