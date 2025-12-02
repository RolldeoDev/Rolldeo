/**
 * NamespaceAccordion Component
 *
 * Collapsible accordion for grouping collections by namespace.
 * Features animated expansion, staggered card reveals, and copper accent styling.
 */

import { memo, useCallback } from 'react'
import { ChevronRight, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { formatNamespace } from '@/lib/namespaceUtils'
import type { CollectionMeta } from '@/stores/collectionStore'
import { CollectionCard } from './CollectionCard'

interface NamespaceAccordionProps {
  /** Grouped collections by namespace */
  groupedCollections: Map<string, CollectionMeta[]>
  /** Callback when a collection is deleted */
  onDeleteCollection?: (id: string, name: string) => void
}

export const NamespaceAccordion = memo(function NamespaceAccordion({
  groupedCollections,
  onDeleteCollection,
}: NamespaceAccordionProps) {
  const { libraryExpandedNamespaces, toggleLibraryNamespaceExpanded } = useUIStore()

  if (groupedCollections.size === 0) {
    return (
      <div className="card-elevated border border-dashed border-white/10 p-8 text-center">
        <div className="icon-container icon-copper mx-auto mb-4 w-fit">
          <FolderOpen className="h-6 w-6" />
        </div>
        <p className="text-muted-foreground">
          No collections match your filters
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {Array.from(groupedCollections.entries()).map(([namespace, collections], groupIndex) => (
        <NamespaceGroup
          key={namespace}
          namespace={namespace}
          collections={collections}
          isExpanded={libraryExpandedNamespaces.includes(namespace)}
          onToggle={() => toggleLibraryNamespaceExpanded(namespace)}
          onDeleteCollection={onDeleteCollection}
          groupIndex={groupIndex}
        />
      ))}
    </div>
  )
})

interface NamespaceGroupProps {
  namespace: string
  collections: CollectionMeta[]
  isExpanded: boolean
  onToggle: () => void
  onDeleteCollection?: (id: string, name: string) => void
  groupIndex: number
}

const NamespaceGroup = memo(function NamespaceGroup({
  namespace,
  collections,
  isExpanded,
  onToggle,
  onDeleteCollection,
  groupIndex,
}: NamespaceGroupProps) {
  const handleDelete = useCallback((id: string, name: string) => {
    if (onDeleteCollection) {
      onDeleteCollection(id, name)
    }
  }, [onDeleteCollection])

  // Count preloaded vs user collections
  const preloadedCount = collections.filter((c) => c.isPreloaded).length
  const userCount = collections.filter((c) => !c.isPreloaded).length

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all duration-300',
        isExpanded
          ? 'border-copper/30 bg-gradient-to-b from-copper/5 to-transparent'
          : 'border-white/10 bg-card hover:border-white/20'
      )}
      style={{ animationDelay: `${groupIndex * 0.05}s` }}
    >
      {/* Accordion Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors',
          isExpanded ? 'bg-copper/10' : 'hover:bg-white/5'
        )}
      >
        {/* Chevron */}
        <ChevronRight
          className={cn(
            'h-5 w-5 flex-shrink-0 transition-transform duration-300',
            isExpanded ? 'rotate-90 text-copper' : 'text-muted-foreground'
          )}
        />

        {/* Folder icon with copper accent */}
        <div className={cn(
          'p-2 rounded-lg transition-colors',
          isExpanded
            ? 'bg-copper/20 text-copper'
            : 'bg-white/5 text-muted-foreground'
        )}>
          <FolderOpen className="h-4 w-4" />
        </div>

        {/* Namespace name */}
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            'font-semibold truncate transition-colors',
            isExpanded ? 'text-copper' : 'text-foreground'
          )}>
            {formatNamespace(namespace)}
          </h3>
          <p className="text-xs text-muted-foreground">
            {collections.length} collection{collections.length !== 1 ? 's' : ''}
            {preloadedCount > 0 && userCount > 0 && (
              <span className="ml-1">
                ({preloadedCount} bundled, {userCount} imported)
              </span>
            )}
          </p>
        </div>

        {/* Collection count badge */}
        <span className={cn(
          'px-2.5 py-1 rounded-full text-sm font-medium transition-colors',
          isExpanded
            ? 'bg-copper/20 text-copper'
            : 'bg-white/10 text-muted-foreground'
        )}>
          {collections.length}
        </span>
      </button>

      {/* Accordion Content */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-out',
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="p-4 pt-2 border-t border-copper/10">
            {/* User collections section */}
            {userCount > 0 && (
              <div className={cn(preloadedCount > 0 && 'mb-6')}>
                {preloadedCount > 0 && (
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Your Collections
                  </h4>
                )}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {collections
                    .filter((c) => !c.isPreloaded)
                    .map((collection, index) => (
                      <CollectionCard
                        key={collection.id}
                        collection={collection}
                        onDelete={() => handleDelete(collection.id, collection.name)}
                        index={index}
                        compact
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Preloaded collections section */}
            {preloadedCount > 0 && (
              <div>
                {userCount > 0 && (
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Bundled Collections
                  </h4>
                )}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {collections
                    .filter((c) => c.isPreloaded)
                    .map((collection, index) => (
                      <CollectionCard
                        key={collection.id}
                        collection={collection}
                        index={index}
                        compact
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

export default NamespaceAccordion
