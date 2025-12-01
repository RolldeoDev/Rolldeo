/**
 * TraceViewer Component
 *
 * Displays the hierarchical trace tree for a roll operation.
 */

import { memo, useState, useCallback } from 'react'
import {
  Activity,
  X,
  ChevronRight,
  Play,
  Table2,
  FileText,
  Target,
  Code,
  Dice6,
  Calculator,
  Variable,
  AtSign,
  GitBranch,
  Repeat,
  Hash,
  Layers,
  Combine,
  Grab,
  ListOrdered,
  FolderOpen,
} from 'lucide-react'
import type {
  RollTrace,
  TraceNode,
  TraceNodeType,
  CompositeSelectMetadata,
  DiceRollMetadata,
  CaptureMultiRollMetadata,
  CaptureAccessMetadata,
  CollectMetadata,
} from '@/engine/core/trace'

interface TraceViewerProps {
  trace: RollTrace
  onClose: () => void
}

const NODE_TYPE_ICONS: Record<TraceNodeType, React.ElementType> = {
  root: Play,
  table_roll: Table2,
  template_roll: FileText,
  template_ref: FileText,
  entry_select: Target,
  expression: Code,
  dice_roll: Dice6,
  math_eval: Calculator,
  variable_access: Variable,
  placeholder_access: AtSign,
  conditional: GitBranch,
  multi_roll: Repeat,
  instance: Hash,
  composite_select: Layers,
  collection_merge: Combine,
  capture_multi_roll: Grab,
  capture_access: ListOrdered,
  collect: FolderOpen,
}

const NODE_TYPE_COLORS: Record<TraceNodeType, string> = {
  root: 'text-copper',
  table_roll: 'text-mint',              // Tables = Green/Mint
  template_roll: 'text-lavender',       // Templates = Lavender
  template_ref: 'text-lavender',        // Templates = Lavender
  entry_select: 'text-mint',            // Table operation = Green
  expression: 'text-gray-400',
  dice_roll: 'text-purple-400',
  math_eval: 'text-cyan-400',
  variable_access: 'text-pink-400',
  placeholder_access: 'text-orange-400',
  conditional: 'text-red-400',
  multi_roll: 'text-mint',              // Table operation = Green
  instance: 'text-teal-400',
  composite_select: 'text-mint-dark',   // Composite tables = Darker mint
  collection_merge: 'text-mint',        // Table operation = Green
  capture_multi_roll: 'text-rose-400',
  capture_access: 'text-sky-400',
  collect: 'text-emerald-400',
}

function collectNodeIds(node: TraceNode): string[] {
  const ids = [node.id]
  for (const child of node.children) {
    ids.push(...collectNodeIds(child))
  }
  return ids
}

export const TraceViewer = memo(function TraceViewer({
  trace,
  onClose,
}: TraceViewerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set([trace.root.id])
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  const selectNode = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId))
  }, [])

  const expandAll = useCallback(() => {
    const allIds = collectNodeIds(trace.root)
    setExpandedNodes(new Set(allIds))
  }, [trace.root])

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set([trace.root.id]))
  }, [trace.root.id])

  return (
    <div className="border border-copper/30 rounded-xl bg-background/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-copper/20 bg-copper/5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-copper" />
          <span className="font-medium">Execution Trace</span>
          <span className="text-xs text-muted-foreground">
            ({trace.stats.nodeCount} ops, {trace.totalTime}ms)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={expandAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Collapse
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tree View */}
      <div className="max-h-[400px] overflow-auto p-2">
        <TraceTreeNode
          node={trace.root}
          depth={0}
          expandedNodes={expandedNodes}
          onToggle={toggleNode}
          selectedNodeId={selectedNodeId}
          onSelect={selectNode}
        />
      </div>

      {/* Stats Footer */}
      <div className="px-4 py-2 border-t border-copper/20 bg-copper/5 text-xs text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          {trace.stats.diceRolled > 0 && (
            <span>Dice: {trace.stats.diceRolled}</span>
          )}
          {trace.stats.tablesAccessed.length > 0 && (
            <span>Tables: {trace.stats.tablesAccessed.length}</span>
          )}
          {trace.stats.variablesAccessed.length > 0 && (
            <span>Variables: {trace.stats.variablesAccessed.length}</span>
          )}
          <span>Depth: {trace.stats.maxDepth}</span>
        </div>
      </div>
    </div>
  )
})

interface TraceTreeNodeProps {
  node: TraceNode
  depth: number
  expandedNodes: Set<string>
  onToggle: (nodeId: string) => void
  selectedNodeId: string | null
  onSelect: (nodeId: string) => void
}

const TraceTreeNode = memo(function TraceTreeNode({
  node,
  depth,
  expandedNodes,
  onToggle,
  selectedNodeId,
  onSelect,
}: TraceTreeNodeProps) {
  const isExpanded = expandedNodes.has(node.id)
  const isSelected = selectedNodeId === node.id
  const hasChildren = node.children.length > 0
  const Icon = NODE_TYPE_ICONS[node.type]
  const colorClass = NODE_TYPE_COLORS[node.type]

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(node.id)
  }

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) {
      onToggle(node.id)
    }
  }

  return (
    <div style={{ marginLeft: depth * 16 }}>
      {/* Node Header */}
      <div
        className={`
          flex items-center gap-2 py-1 px-2 rounded cursor-pointer
          hover:bg-accent transition-colors
          ${isSelected ? 'bg-copper/10 border-l-2 border-copper' : ''}
        `}
        onClick={handleClick}
      >
        {/* Expand/Collapse Arrow */}
        {hasChildren ? (
          <ChevronRight
            className={`w-3 h-3 transition-transform flex-shrink-0 hover:text-copper ${
              isExpanded ? 'rotate-90' : ''
            }`}
            onClick={handleExpandClick}
          />
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        {/* Icon */}
        <Icon className={`w-4 h-4 flex-shrink-0 ${colorClass}`} />

        {/* Label with tooltip */}
        <span className="text-sm font-mono truncate" title={node.label}>
          {node.label}
        </span>

        {/* Output Preview with tooltip - special handling for dice rolls */}
        {node.output.value && (
          <span
            className="text-xs text-muted-foreground ml-auto truncate max-w-[300px]"
            title={String(node.output.value)}
          >
            &rarr;{' '}
            {node.type === 'dice_roll' && node.metadata?.type === 'dice' ? (
              <span>
                <span className="text-purple-400">[{(node.metadata as DiceRollMetadata).rolls.join(', ')}]</span>
                {(node.metadata as DiceRollMetadata).kept.length !== (node.metadata as DiceRollMetadata).rolls.length && (
                  <span className="text-green-400"> keep [{(node.metadata as DiceRollMetadata).kept.join(', ')}]</span>
                )}
                <span> = {node.output.value}</span>
              </span>
            ) : (
              String(node.output.value)
            )}
          </span>
        )}

        {/* Duration */}
        {node.duration !== undefined && node.duration > 0 && (
          <span className="text-xs text-muted-foreground/50 flex-shrink-0">
            {node.duration}ms
          </span>
        )}
      </div>

      {/* Selected Node Detail Panel */}
      {isSelected && (
        <div
          style={{ marginLeft: 20 }}
          className="mt-1 mb-2 p-3 bg-muted/50 rounded-lg text-xs space-y-2 border border-border/50"
        >
          <div>
            <span className="text-muted-foreground font-medium">Label: </span>
            <span className="font-mono break-all">{node.label}</span>
          </div>
          {node.output.value && (
            <div>
              <span className="text-muted-foreground font-medium">Output: </span>
              {node.type === 'dice_roll' && node.metadata?.type === 'dice' ? (
                <span className="font-mono">
                  <span className="text-purple-400">[{(node.metadata as DiceRollMetadata).rolls.join(', ')}]</span>
                  {(node.metadata as DiceRollMetadata).kept.length !== (node.metadata as DiceRollMetadata).rolls.length && (
                    <span className="text-green-400"> keep [{(node.metadata as DiceRollMetadata).kept.join(', ')}]</span>
                  )}
                  {(node.metadata as DiceRollMetadata).modifier && (
                    <span className="text-cyan-400">
                      {' '}{(node.metadata as DiceRollMetadata).modifier!.operator}{(node.metadata as DiceRollMetadata).modifier!.value}
                    </span>
                  )}
                  <span> = {node.output.value}</span>
                </span>
              ) : (
                <span className="font-mono break-all">{String(node.output.value)}</span>
              )}
            </div>
          )}
          {node.input.raw && (
            <div>
              <span className="text-muted-foreground font-medium">Input: </span>
              <span className="font-mono break-all">{node.input.raw}</span>
            </div>
          )}
          {node.type && (
            <div>
              <span className="text-muted-foreground font-medium">Type: </span>
              <span className={colorClass}>{node.type}</span>
            </div>
          )}
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <>
          {/* Type-specific details */}
          <TraceNodeDetails node={node} depth={depth} />

          {/* Children */}
          {node.children.map((child) => (
            <TraceTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </div>
  )
})

interface TraceNodeDetailsProps {
  node: TraceNode
  depth: number
}

const TraceNodeDetails = memo(function TraceNodeDetails({
  node,
  depth,
}: TraceNodeDetailsProps) {
  if (!node.metadata) return null

  const baseMargin = (depth + 1) * 16 + 12

  // Type-specific rendering
  switch (node.metadata.type) {
    case 'dice':
      return (
        <div
          style={{ marginLeft: baseMargin }}
          className="text-xs py-1 font-mono text-muted-foreground"
        >
          <span className="text-purple-400/70">
            [{node.metadata.rolls.join(', ')}]
          </span>
          {node.metadata.kept.length !== node.metadata.rolls.length && (
            <>
              <span className="text-muted-foreground/50 mx-1">&rarr;</span>
              <span className="text-green-400/70">
                keep [{node.metadata.kept.join(', ')}]
              </span>
            </>
          )}
          {node.metadata.modifier && (
            <>
              <span className="text-muted-foreground/50 mx-1">&rarr;</span>
              <span>
                {node.metadata.kept.reduce((a, b) => a + b, 0)}{' '}
                {node.metadata.modifier.operator} {node.metadata.modifier.value}
              </span>
            </>
          )}
          <span className="text-muted-foreground/70 ml-1">
            = {node.metadata.kept.reduce((a, b) => a + b, 0)}
            {node.metadata.modifier &&
              (node.metadata.modifier.operator === '+'
                ? node.metadata.kept.reduce((a, b) => a + b, 0) +
                  node.metadata.modifier.value
                : node.metadata.modifier.operator === '-'
                ? node.metadata.kept.reduce((a, b) => a + b, 0) -
                  node.metadata.modifier.value
                : node.metadata.kept.reduce((a, b) => a + b, 0) *
                  node.metadata.modifier.value) !== node.output.value &&
              ` = ${node.output.value}`}
          </span>
        </div>
      )

    case 'entry_select':
      const probabilityPct = (node.metadata.probability * 100).toFixed(1)
      return (
        <div
          style={{ marginLeft: baseMargin }}
          className="text-xs py-1 text-muted-foreground space-y-0.5"
        >
          <div className="flex items-center gap-2">
            <span>
              Weight: {node.metadata.selectedWeight}/{node.metadata.totalWeight}
            </span>
            <span className="text-muted-foreground/50">|</span>
            <span>{probabilityPct}% chance</span>
            <span className="text-muted-foreground/50">|</span>
            <span>{node.metadata.poolSize} entries</span>
            {node.metadata.unique && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span className="text-amber-400/70">unique</span>
              </>
            )}
          </div>
        </div>
      )

    case 'variable':
      return (
        <div
          style={{ marginLeft: baseMargin }}
          className="text-xs py-1 text-muted-foreground"
        >
          <span className="text-pink-400/70">${node.metadata.name}</span>
          <span className="text-muted-foreground/50 mx-1">=</span>
          <span>"{node.output.value}"</span>
          <span className="text-muted-foreground/50 ml-2">({node.metadata.source})</span>
        </div>
      )

    case 'placeholder':
      return (
        <div
          style={{ marginLeft: baseMargin }}
          className="text-xs py-1 text-muted-foreground"
        >
          <span className="text-orange-400/70">
            @{node.metadata.name}
            {node.metadata.property && `.${node.metadata.property}`}
          </span>
          <span className="text-muted-foreground/50 mx-1">=</span>
          <span>
            {node.metadata.found ? `"${node.output.value}"` : '(not found)'}
          </span>
        </div>
      )

    case 'conditional':
      return (
        <div
          style={{ marginLeft: baseMargin }}
          className="text-xs py-1 text-muted-foreground"
        >
          <span className="text-red-400/70">when:</span>
          <span className="ml-1">{node.metadata.when}</span>
          <span className="text-muted-foreground/50 mx-1">&rarr;</span>
          <span
            className={
              node.metadata.matched ? 'text-green-400' : 'text-red-400/50'
            }
          >
            {node.metadata.matched ? 'matched' : 'not matched'}
          </span>
          {node.metadata.matched && node.metadata.action && (
            <span className="text-muted-foreground/70 ml-1">({node.metadata.action})</span>
          )}
        </div>
      )

    case 'composite_select': {
      const compositeMetadata = node.metadata as CompositeSelectMetadata
      return (
        <div
          style={{ marginLeft: baseMargin }}
          className="text-xs py-1 text-muted-foreground"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {compositeMetadata.sources.map((source, i) => (
              <span key={source.tableId}>
                <span
                  className={
                    source.tableId === compositeMetadata.selectedTableId
                      ? 'text-yellow-400'
                      : ''
                  }
                >
                  {source.tableId}
                </span>
                <span className="text-muted-foreground/50">
                  ({(source.probability * 100).toFixed(0)}%)
                </span>
                {i < compositeMetadata.sources.length - 1 && (
                  <span className="text-muted-foreground/50 mx-1">|</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )
    }

    case 'multi_roll':
      return (
        <div
          style={{ marginLeft: baseMargin }}
          className="text-xs py-1 text-muted-foreground"
        >
          <span>
            {node.metadata.count}x {node.metadata.tableId}
          </span>
          {node.metadata.unique && (
            <span className="text-amber-400/70 ml-2">unique</span>
          )}
          <span className="text-muted-foreground/50 ml-2">
            (sep: "{node.metadata.separator}")
          </span>
        </div>
      )

    case 'instance':
      return (
        <div
          style={{ marginLeft: baseMargin }}
          className="text-xs py-1 text-muted-foreground"
        >
          <span className="text-teal-400/70">#{node.metadata.name}</span>
          <span className="text-muted-foreground/50 mx-1">=</span>
          <span>{node.metadata.cached ? '(cached)' : '(new roll)'}</span>
        </div>
      )

    case 'collection_merge':
      return (
        <div
          style={{ marginLeft: baseMargin }}
          className="text-xs py-1 text-muted-foreground"
        >
          <span>
            {node.metadata.sourceTables.length} tables, {node.metadata.totalEntries} entries,
            weight: {node.metadata.totalWeight}
          </span>
        </div>
      )

    case 'capture_multi_roll': {
      const captureMetadata = node.metadata as CaptureMultiRollMetadata
      return (
        <div
          style={{ marginLeft: baseMargin }}
          className="text-xs py-1 text-muted-foreground space-y-1"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-rose-400/70">
              ${captureMetadata.captureVar}
            </span>
            <span className="text-muted-foreground/50">=</span>
            <span>
              {captureMetadata.count}x {captureMetadata.tableId}
            </span>
            {captureMetadata.unique && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span className="text-amber-400/70">unique</span>
              </>
            )}
            {captureMetadata.silent && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span className="text-muted-foreground/50">silent</span>
              </>
            )}
          </div>
          {captureMetadata.capturedItems.length > 0 && (
            <div className="pl-2 border-l border-border/50">
              {captureMetadata.capturedItems.slice(0, 5).map((item, i) => (
                <div key={i} className="truncate">
                  <span className="text-muted-foreground/50">[{i}]</span>
                  <span className="ml-1">"{item.value}"</span>
                  {Object.keys(item.sets).length > 0 && (
                    <span className="text-muted-foreground/50 ml-1">
                      ({Object.keys(item.sets).join(', ')})
                    </span>
                  )}
                </div>
              ))}
              {captureMetadata.capturedItems.length > 5 && (
                <div className="text-muted-foreground/50">
                  ... +{captureMetadata.capturedItems.length - 5} more
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    case 'capture_access': {
      const accessMetadata = node.metadata as CaptureAccessMetadata
      return (
        <div
          style={{ marginLeft: baseMargin }}
          className="text-xs py-1 text-muted-foreground"
        >
          <span className="text-sky-400/70">${accessMetadata.varName}</span>
          {accessMetadata.index !== undefined && (
            <span className="text-sky-400/70">[{accessMetadata.index}]</span>
          )}
          {accessMetadata.property && accessMetadata.property !== 'value' && (
            <span className="text-sky-400/70">.{accessMetadata.property}</span>
          )}
          <span className="text-muted-foreground/50 mx-1">=</span>
          <span>
            {accessMetadata.found ? `"${node.output.value}"` : '(not found)'}
          </span>
          {accessMetadata.totalItems !== undefined && (
            <span className="text-muted-foreground/50 ml-2">
              ({accessMetadata.totalItems} items)
            </span>
          )}
        </div>
      )
    }

    case 'collect': {
      const collectMetadata = node.metadata as CollectMetadata
      return (
        <div
          style={{ marginLeft: baseMargin }}
          className="text-xs py-1 text-muted-foreground space-y-1"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-emerald-400/70">
              collect: ${collectMetadata.varName}.{collectMetadata.property}
            </span>
            {collectMetadata.unique && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span className="text-amber-400/70">unique</span>
              </>
            )}
            <span className="text-muted-foreground/50">
              (sep: "{collectMetadata.separator}")
            </span>
          </div>
          <div className="pl-2 border-l border-border/50">
            <span className="text-muted-foreground/50">values: </span>
            <span>[{collectMetadata.allValues.slice(0, 10).map(v => `"${v}"`).join(', ')}]</span>
            {collectMetadata.allValues.length > 10 && (
              <span className="text-muted-foreground/50"> +{collectMetadata.allValues.length - 10} more</span>
            )}
            {collectMetadata.unique && collectMetadata.resultValues.length !== collectMetadata.allValues.length && (
              <div>
                <span className="text-muted-foreground/50">&rarr; deduped: </span>
                <span>[{collectMetadata.resultValues.slice(0, 10).map(v => `"${v}"`).join(', ')}]</span>
              </div>
            )}
          </div>
        </div>
      )
    }

    default:
      return null
  }
})

export default TraceViewer
