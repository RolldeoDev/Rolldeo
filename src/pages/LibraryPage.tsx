import { useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, FolderOpen, Trash2, Dices, Loader2, X, BookOpen, Layers } from 'lucide-react'
import { useCollections } from '../hooks/useCollections'
import { useKeyboardShortcuts, type KeyboardShortcut } from '../hooks'
import { useUIStore } from '../stores/uiStore'
import type { CollectionMeta } from '../stores/collectionStore'
import { cn } from '../lib/utils'

const tagColors = [
  'pill-mint',
  'pill-lavender',
  'pill-amber',
]

export function LibraryPage() {
  const searchInputRef = useRef<HTMLInputElement>(null)

  const {
    preloaded,
    userCollections,
    allTags,
    isLoading,
    isInitialized,
    error,
    deleteCollection,
  } = useCollections()

  const { searchQuery, selectedTags, setSearchQuery, toggleTag, clearFilters } =
    useUIStore()

  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      {
        key: 'Slash',
        handler: () => {
          searchInputRef.current?.focus()
        },
        description: 'Focus search',
      },
    ],
    []
  )

  useKeyboardShortcuts({ shortcuts })

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      await deleteCollection(id)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Library</h1>
          <p className="text-muted-foreground">Browse and manage your table collections</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search collections... (/)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-dark pl-11 w-full sm:w-72"
          />
        </div>
      </div>

      {/* Tags filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Filter:</span>
          {allTags.slice(0, 10).map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                'pill transition-all duration-200',
                selectedTags.includes(tag)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'pill-outline hover:border-white/30'
              )}
            >
              {tag}
            </button>
          ))}
          {(searchQuery || selectedTags.length > 0) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1 text-sm text-muted-foreground hover:text-foreground rounded-full hover:bg-white/5 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && !isInitialized && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading collections...</p>
          </div>
        </div>
      )}

      {/* Pre-loaded Collections */}
      {preloaded.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="icon-container icon-lavender">
              <BookOpen className="h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold">Pre-loaded Collections</h2>
            <span className="text-sm text-muted-foreground">({preloaded.length})</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {preloaded.map((collection, index) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                index={index}
              />
            ))}
          </div>
        </section>
      )}

      {/* User Collections */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="icon-container icon-mint">
            <Layers className="h-4 w-4" />
          </div>
          <h2 className="text-xl font-semibold">Your Collections</h2>
          <span className="text-sm text-muted-foreground">({userCollections.length})</span>
        </div>
        {userCollections.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {userCollections.map((collection, index) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onDelete={() => handleDelete(collection.id, collection.name)}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="card-elevated border border-dashed border-white/10 p-8 text-center">
            <div className="icon-container icon-mint mx-auto mb-4 w-fit">
              <FolderOpen className="h-6 w-6" />
            </div>
            <p className="text-muted-foreground">
              {searchQuery || selectedTags.length > 0
                ? 'No collections match your filters'
                : 'No custom collections yet. Upload a JSON or ZIP file to get started.'}
            </p>
          </div>
        )}
      </section>

      {/* Empty state */}
      {!isLoading && preloaded.length === 0 && userCollections.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No collections found. Try clearing your filters.</p>
        </div>
      )}
    </div>
  )
}

interface CollectionCardProps {
  collection: CollectionMeta
  onDelete?: () => void
  index?: number
}

function CollectionCard({ collection, onDelete, index = 0 }: CollectionCardProps) {
  return (
    <div
      className="card-elevated p-5 border border-white/5 group transition-all duration-300 hover:border-white/10 hover:scale-[1.01] animate-slide-up"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-lg leading-tight">{collection.name}</h3>
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete()
            }}
            className="p-2 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded-lg transition-all -mt-1 -mr-1"
            title="Delete collection"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[2.5rem]">
        {collection.description || `Collection with ${collection.tableCount} tables`}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4 min-h-[1.75rem]">
        {collection.tags.slice(0, 3).map((tag, tagIndex) => (
          <span
            key={tag}
            className={cn('pill', tagColors[tagIndex % tagColors.length])}
          >
            {tag}
          </span>
        ))}
        {collection.tags.length > 3 && (
          <span className="pill pill-outline">
            +{collection.tags.length - 3}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4 pb-4 border-b border-white/5">
        <span className="flex items-center gap-1.5">
          <Dices className="h-3.5 w-3.5" />
          {collection.tableCount} table{collection.tableCount !== 1 ? 's' : ''}
        </span>
        {collection.templateCount > 0 && (
          <span className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {collection.templateCount} template{collection.templateCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          to={`/roll?collection=${collection.id}`}
          className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 text-sm"
        >
          <Dices className="h-4 w-4" />
          Roll
        </Link>
        <Link
          to={`/editor/${collection.id}`}
          className="flex-1 btn-secondary flex items-center justify-center py-2.5 text-sm"
        >
          View
        </Link>
      </div>
    </div>
  )
}
