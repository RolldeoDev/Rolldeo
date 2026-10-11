/**
 * InheritanceTree Component
 *
 * Displays the inheritance chain of a table that uses `extends`.
 */

import { memo } from 'react'
import { ArrowDown, FileText, Hash } from 'lucide-react'
import type { InheritanceNode } from '@/hooks/useTableVisualization'

interface InheritanceTreeProps {
  nodes: InheritanceNode[]
}

export const InheritanceTree = memo(function InheritanceTree({
  nodes,
}: InheritanceTreeProps) {
  if (nodes.length <= 1) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        This table does not extend any other tables
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      {nodes.map((node, index) => (
        <div key={node.tableId} className="flex flex-col items-center">
          {/* Arrow connector (not on first item) */}
          {index > 0 && (
            <div className="flex flex-col items-center my-1">
              <div className="w-px h-3 bg-border" />
              <ArrowDown className="w-4 h-4 text-muted-foreground" />
              <div className="w-px h-3 bg-border" />
            </div>
          )}

          {/* Node card */}
          <div
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors
              ${index === 0
                ? 'bg-primary/10 border-primary/30'
                : 'bg-muted/30 border-border/50 hover:bg-muted/50'}
            `}
          >
            <FileText className={`w-5 h-5 ${index === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="flex flex-col">
              <span className={`font-medium text-sm ${index === 0 ? 'text-primary' : ''}`}>
                {node.tableName}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {node.tableId}
              </span>
            </div>
            <div className="flex items-center gap-1 ml-4 px-2 py-1 bg-background/50 rounded text-xs text-muted-foreground">
              <Hash className="w-3 h-3" />
              {node.entryCount}
            </div>
          </div>

          {/* Level indicator */}
          {index > 0 && (
            <span className="text-[10px] text-muted-foreground mt-1">
              extends (level {node.level})
            </span>
          )}
        </div>
      ))}

      {/* Total inheritance depth */}
      {nodes.length > 1 && (
        <div className="pt-4 text-center text-xs text-muted-foreground border-t border-border/30 mt-4 w-full">
          Inheritance depth: {nodes.length - 1} level{nodes.length > 2 ? 's' : ''}
        </div>
      )}
    </div>
  )
})

export default InheritanceTree
