/**
 * TableTypeIcon Component
 *
 * Icon representing the type of table or template.
 */

import { memo } from 'react'
import { Table2, Layers, FolderTree, FileText } from 'lucide-react'

interface TableTypeIconProps {
  /** Type of the item */
  type: 'simple' | 'composite' | 'collection' | 'template'
  /** Size class (tailwind) */
  className?: string
}

export const TableTypeIcon = memo(function TableTypeIcon({
  type,
  className = 'w-4 h-4',
}: TableTypeIconProps) {
  switch (type) {
    case 'simple':
      return <Table2 className={`${className} text-mint`} aria-label="Simple table" />
    case 'composite':
      return <Layers className={`${className} text-mint-dark`} aria-label="Composite table" />
    case 'collection':
      return <FolderTree className={`${className} text-amber`} aria-label="Collection table" />
    case 'template':
      return <FileText className={`${className} text-lavender`} aria-label="Template" />
    default:
      return <Table2 className={`${className} text-muted-foreground`} />
  }
})

export default TableTypeIcon
