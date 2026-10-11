/**
 * IncludesEditor Component
 *
 * Manages the imports array for external collection references.
 */

import { useCallback, useMemo } from 'react'
import { Link2, Trash2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Import } from '@/engine/types'
import { useCollectionStore, type CollectionMeta } from '@/stores/collectionStore'
import { CollectionPathSelector } from './CollectionPathSelector'

interface IncludesEditorProps {
  imports: Import[]
  onChange: (imports: Import[]) => void
  /** Current collection's namespace, used to filter it from available imports */
  currentNamespace?: string
}

interface ImportCardProps {
  import_: Import
  index: number
  onChange: (index: number, import_: Import) => void
  onDelete: (index: number) => void
  availableCollections: CollectionMeta[]
}

function ImportCard({ import_, index, onChange, onDelete, availableCollections }: ImportCardProps) {
  const hasError = !import_.path.trim() || !import_.alias.trim()
  const aliasHasDot = import_.alias.includes('.')

  const updateField = useCallback(
    <K extends keyof Import>(field: K, value: Import[K]) => {
      onChange(index, { ...import_, [field]: value })
    },
    [import_, index, onChange]
  )

  return (
    <div
      className={cn(
        'group border rounded-xl p-4 transition-all hover:border-border',
        hasError || aliasHasDot
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-border/50 bg-card/50'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn(
          'p-2 rounded-lg',
          hasError || aliasHasDot ? 'bg-destructive/10' : 'bg-[hsl(var(--amber)/0.1)]'
        )}>
          <Link2 className={cn(
            'h-4 w-4',
            hasError || aliasHasDot ? 'text-destructive' : 'text-[hsl(var(--amber))]'
          )} />
        </div>

        {/* Fields */}
        <div className="flex-1 space-y-3">
          {/* Alias Field */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Alias <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={import_.alias}
              onChange={(e) => updateField('alias', e.target.value)}
              placeholder="myCollection"
              className={cn(
                'w-full px-3 py-2 text-sm rounded-lg border bg-background transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-primary/50',
                aliasHasDot || !import_.alias.trim()
                  ? 'border-destructive/50 focus:border-destructive'
                  : 'border-border/50 focus:border-primary'
              )}
            />
            {aliasHasDot && (
              <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Alias cannot contain dots
              </p>
            )}
          </div>

          {/* Path Field */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Path <span className="text-destructive">*</span>
            </label>
            <CollectionPathSelector
              value={import_.path}
              onChange={(path) => updateField('path', path)}
              availableCollections={availableCollections}
              placeholder="Select collection or enter URL..."
              hasError={!import_.path.trim()}
            />
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Description <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <input
              type="text"
              value={import_.description || ''}
              onChange={(e) => updateField('description', e.target.value || undefined)}
              placeholder="What does this import provide?"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border/50 bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>
        </div>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(index)}
          className="p-2 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded-lg transition-all"
          title="Delete import"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </button>
      </div>

      {/* Usage Hint */}
      {import_.alias.trim() && !aliasHasDot && (
        <div className="mt-3 pt-3 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            Use as:{' '}
            <code className="px-1.5 py-0.5 bg-muted rounded text-[hsl(var(--amber))]">
              {`{{${import_.alias}.tableId}}`}
            </code>
          </p>
        </div>
      )}
    </div>
  )
}

export function IncludesEditor({ imports, onChange, currentNamespace }: IncludesEditorProps) {
  // Select the collections Map directly to avoid infinite re-renders
  const collectionsMap = useCollectionStore((state) => state.collections)

  // Filter out the current collection from available imports
  const availableCollections = useMemo(() => {
    const allCollections = Array.from(collectionsMap.values())
    if (!currentNamespace) return allCollections
    return allCollections.filter((c) => c.namespace !== currentNamespace)
  }, [collectionsMap, currentNamespace])

  const updateImport = useCallback(
    (index: number, import_: Import) => {
      const updated = [...imports]
      updated[index] = import_
      onChange(updated)
    },
    [imports, onChange]
  )

  const deleteImport = useCallback(
    (index: number) => {
      onChange(imports.filter((_, i) => i !== index))
    },
    [imports, onChange]
  )

  if (imports.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-xl p-6 text-center">
        <Link2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground">No imports yet</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Import external collections to reference their tables
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {imports.map((import_, index) => (
        <ImportCard
          key={index}
          import_={import_}
          index={index}
          onChange={updateImport}
          onDelete={deleteImport}
          availableCollections={availableCollections}
        />
      ))}
    </div>
  )
}

export default IncludesEditor
