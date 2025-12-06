import { useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Dices, Library, PenSquare, Sparkles, Wifi, Clock, ArrowRight, Scale, BookOpen } from 'lucide-react'
import { DropZone, ImportDialog } from '../components/upload'
import { QuickRoll } from '../components/home'
import { SEO } from '../components/common'
import { PAGE_SEO } from '../lib/seo'
import { useCollectionStore } from '../stores/collectionStore'
import { generateUniqueId } from '../services/import'
import type { ImportResult, ImportedCollection } from '../services/import'

const quickActions = [
  {
    path: '/roll',
    icon: Dices,
    label: 'Start Rolling',
    description: 'Roll on your favorite tables',
    color: 'mint' as const,
  },
  {
    path: '/library',
    icon: Library,
    label: 'Browse Library',
    description: 'Explore table collections',
    color: 'lavender' as const,
  },
  {
    path: '/editor',
    icon: PenSquare,
    label: 'Create Tables',
    description: 'Build your own random tables',
    color: 'amber' as const,
  },
]

const features = [
  {
    icon: Wifi,
    title: 'Works Offline',
    description: 'Install as a PWA and use Rolldeo without internet.',
    color: 'mint' as const,
  },
  {
    icon: Sparkles,
    title: 'Full Spec Support',
    description: 'Dice rolls, math, inheritance, conditionals & more.',
    color: 'lavender' as const,
  },
  {
    icon: PenSquare,
    title: 'Visual & JSON Editing',
    description: 'Edit with a friendly UI or directly in JSON.',
    color: 'amber' as const,
  },
  {
    icon: Clock,
    title: 'Roll History',
    description: 'Track results and re-roll when you need inspiration.',
    color: 'rose' as const,
  },
]

const colorClasses = {
  mint: {
    icon: 'icon-mint',
    card: 'card-mint',
    text: 'text-mint',
    bg: 'bg-mint',
  },
  lavender: {
    icon: 'icon-lavender',
    card: 'card-lavender',
    text: 'text-lavender',
    bg: 'bg-lavender',
  },
  amber: {
    icon: 'icon-amber',
    card: 'card-amber',
    text: 'text-amber',
    bg: 'bg-amber',
  },
  rose: {
    icon: 'icon-rose',
    card: 'card-rose',
    text: 'text-rose',
    bg: 'bg-rose',
  },
}

export function HomePage() {
  const navigate = useNavigate()
  const { importFiles, saveImportedCollections } = useCollectionStore()
  const collections = useCollectionStore((state) => state.collections)

  const existingIds = useMemo(
    () => new Set(collections.keys()),
    [collections]
  )

  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setIsImporting(true)
    setShowImportDialog(true)

    try {
      const result = await importFiles(files)

      const processedCollections: ImportedCollection[] = result.collections.map(
        (c) => ({
          ...c,
          id: generateUniqueId(c.id, existingIds),
        })
      )

      // Update pathToIdMap with the new IDs (in case generateUniqueId changed them)
      const updatedPathToIdMap = new Map<string, string>()
      if (result.pathToIdMap) {
        for (const [path, oldId] of result.pathToIdMap) {
          // Find the collection with the original ID and get its new ID
          const originalCollection = result.collections.find((c) => c.id === oldId)
          const processedCollection = processedCollections.find(
            (c) => c.fileName === originalCollection?.fileName
          )
          if (processedCollection) {
            updatedPathToIdMap.set(path, processedCollection.id)
          }
        }
      }

      if (processedCollections.length > 0) {
        const source = files.some((f) => f.name.endsWith('.zip')) ? 'zip' : 'file'
        await saveImportedCollections(processedCollections, source, updatedPathToIdMap)
      }

      setImportResult({
        ...result,
        collections: processedCollections,
      })
    } catch (error) {
      setImportResult({
        success: false,
        collections: [],
        errors: [
          {
            fileName: 'Import',
            error: error instanceof Error ? error.message : 'Import failed',
          },
        ],
      })
    } finally {
      setIsImporting(false)
    }
  }, [importFiles, saveImportedCollections, existingIds])

  const handleCloseDialog = useCallback(() => {
    setShowImportDialog(false)
    if (importResult?.success) {
      navigate('/library')
    }
    setImportResult(null)
  }, [importResult, navigate])

  return (
    <>
      <SEO {...PAGE_SEO.home} />
      <div className="space-y-12">
        {/* Hero Section */}
      <section className="text-center space-y-4 py-4">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight animate-slide-up">
          Share the Perfect <span className="gradient-text">Random Table</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto animate-slide-up stagger-1">
          Create, share, and roll on random tables with fellow GMs. Offline-first, open source, and CC0 licensed.
        </p>
      </section>

      {/* Quick Roll Section */}
      <QuickRoll />

      {/* Quick Actions - Card Grid */}
      <section className="grid gap-4 md:grid-cols-3">
        {quickActions.map((action, index) => {
          const colors = colorClasses[action.color]
          return (
            <Link
              key={action.path}
              to={action.path}
              className={`group card-elevated p-6 border transition-all duration-300 hover:scale-[1.02] hover:border-white/10 ${colors.card} animate-slide-up`}
              style={{ animationDelay: `${(index + 1) * 0.1}s` }}
            >
              <div className="flex items-start gap-4">
                <div className={`icon-container ${colors.icon}`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1 group-hover:text-foreground transition-colors">
                    {action.label}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {action.description}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          )
        })}
      </section>

      {/* Upload Section */}
      <section className="animate-slide-up stagger-3">
        <DropZone
          onFilesSelected={handleFilesSelected}
          disabled={isImporting}
        />
      </section>

      {/* Features Grid */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Features</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const colors = colorClasses[feature.color]
            return (
              <div
                key={feature.title}
                className="card-elevated p-5 border border-white/5 animate-slide-up"
                style={{ animationDelay: `${(index + 1) * 0.1}s` }}
              >
                <div className={`icon-container ${colors.icon} w-fit mb-4`}>
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Open Source Section */}
      <section className="card-elevated border border-white/5 p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="icon-container icon-lavender shrink-0">
            <Scale className="h-6 w-6" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-bold mb-2">Fully Open Source & CC0 Licensed</h3>
            <p className="text-muted-foreground">
              Rolldeo is completely free and open source. The code, documentation, and included table collections
              are all released under the CC0 license — use them however you like, no attribution required.
            </p>
          </div>
          <Link
            to="/guide"
            className="btn-secondary flex items-center gap-2 shrink-0"
          >
            <BookOpen className="h-4 w-4" />
            Learn More
          </Link>
        </div>
      </section>

      {/* Stats/Info Banner */}
      <section className="card-elevated border border-white/5 p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold mb-2">Ready to get started?</h3>
            <p className="text-muted-foreground">
              Upload your random tables or explore the pre-loaded collections.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/library"
              className="btn-secondary flex items-center gap-2"
            >
              <Library className="h-4 w-4" />
              Browse Library
            </Link>
            <Link
              to="/roll"
              className="btn-primary flex items-center gap-2"
            >
              <Dices className="h-4 w-4" />
              Start Rolling
            </Link>
          </div>
        </div>
      </section>

      {/* Import Dialog */}
      <ImportDialog
        isOpen={showImportDialog}
        onClose={handleCloseDialog}
        result={importResult}
        isImporting={isImporting}
      />
      </div>
    </>
  )
}
