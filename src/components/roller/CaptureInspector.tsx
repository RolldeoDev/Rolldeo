/**
 * CaptureInspector Component
 *
 * Displays capture variables from a roll result in an expandable panel.
 */

import { memo, useState } from 'react'
import { ChevronRight, Grab, Hash, ListOrdered } from 'lucide-react'
import type { CaptureVariable } from '@/engine/types'

interface CaptureInspectorProps {
  captures: Record<string, CaptureVariable>
  onClose: () => void
}

export const CaptureInspector = memo(function CaptureInspector({
  captures,
  onClose,
}: CaptureInspectorProps) {
  const [expandedVars, setExpandedVars] = useState<Set<string>>(
    new Set(Object.keys(captures))
  )

  const toggleVar = (varName: string) => {
    setExpandedVars((prev) => {
      const next = new Set(prev)
      if (next.has(varName)) {
        next.delete(varName)
      } else {
        next.add(varName)
      }
      return next
    })
  }

  const varNames = Object.keys(captures)

  return (
    <div className="border border-border/50 rounded-xl bg-background/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <Grab className="w-4 h-4 text-rose-400" />
          <span className="font-medium">Capture Variables</span>
          <span className="text-xs text-muted-foreground">
            ({varNames.length} variable{varNames.length !== 1 ? 's' : ''})
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
      </div>

      {/* Variable List */}
      <div className="max-h-[300px] overflow-auto p-2 space-y-1">
        {varNames.map((varName) => (
          <CaptureVariableItem
            key={varName}
            name={varName}
            variable={captures[varName]}
            isExpanded={expandedVars.has(varName)}
            onToggle={() => toggleVar(varName)}
          />
        ))}
      </div>
    </div>
  )
})

interface CaptureVariableItemProps {
  name: string
  variable: CaptureVariable
  isExpanded: boolean
  onToggle: () => void
}

const CaptureVariableItem = memo(function CaptureVariableItem({
  name,
  variable,
  isExpanded,
  onToggle,
}: CaptureVariableItemProps) {
  return (
    <div className="rounded-lg border border-border/30 overflow-hidden">
      {/* Variable header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors text-left"
      >
        <ChevronRight
          className={`w-3 h-3 transition-transform flex-shrink-0 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
        <span className="text-rose-400 font-mono text-sm">${name}</span>
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
          <Hash className="w-3 h-3" />
          {variable.count} item{variable.count !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {variable.items.map((item, index) => (
            <CaptureItemDisplay key={index} item={item} index={index} />
          ))}
        </div>
      )}
    </div>
  )
})

interface CaptureItemDisplayProps {
  item: { value: string; sets: Record<string, string> }
  index: number
}

const CaptureItemDisplay = memo(function CaptureItemDisplay({
  item,
  index,
}: CaptureItemDisplayProps) {
  const [showSets, setShowSets] = useState(false)
  const setKeys = Object.keys(item.sets)

  return (
    <div className="pl-4 border-l-2 border-border/50">
      <div className="flex items-start gap-2">
        <span className="text-sky-400/70 font-mono text-xs flex-shrink-0">
          [{index}]
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-mono truncate" title={item.value}>
            "{item.value}"
          </div>
          {setKeys.length > 0 && (
            <button
              onClick={() => setShowSets(!showSets)}
              className="text-xs text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1"
            >
              <ListOrdered className="w-3 h-3" />
              {showSets ? 'Hide' : 'Show'} {setKeys.length} set
              {setKeys.length !== 1 ? 's' : ''}
            </button>
          )}
          {showSets && setKeys.length > 0 && (
            <div className="mt-2 space-y-1 text-xs">
              {setKeys.map((key) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-orange-400/70">@{key}:</span>
                  <span className="text-muted-foreground truncate" title={item.sets[key]}>
                    "{item.sets[key]}"
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default CaptureInspector
