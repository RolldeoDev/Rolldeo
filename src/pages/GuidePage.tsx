/**
 * GuidePage
 *
 * Landing page for the Guide section with navigation cards and download buttons.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Rocket,
  FileCode,
  Database,
  Monitor,
  Download,
  ArrowRight,
  Sparkles,
  Github,
  Scale,
  Package,
  ChevronDown,
  Swords,
  RocketIcon,
} from 'lucide-react'
import { DownloadButton } from '@/components/guide'

// Import raw markdown files for download
import specMd from '@/../docs/randomTableSpecV1.md?raw'
import schemaJson from '@/../public/schemas/random-table-spec-v1.0.json?raw'

const guideCards = [
  {
    id: 'quickstart',
    title: 'Getting Started',
    description:
      'Learn the basics of random tables in under 10 minutes. Create your first table, add weights, roll dice, and more.',
    icon: Rocket,
    path: '/guide/quickstart',
    color: 'mint',
    tags: ['Beginner', '10 min read'],
  },
  {
    id: 'using-rolldeo',
    title: 'Using Rolldeo',
    description:
      'Master the Library, Roller, and Editor. Learn how to import collections, roll on tables, and create your own.',
    icon: Monitor,
    path: '/guide/using-rolldeo',
    color: 'lavender',
    tags: ['App Guide', 'Features'],
  },
  {
    id: 'spec',
    title: 'Full Specification',
    description:
      'Complete reference for the Random Table JSON Spec v1.0. Covers all features including imports, inheritance, and conditionals.',
    icon: FileCode,
    path: '/guide/spec',
    color: 'amber',
    tags: ['Reference', 'Advanced'],
  },
  {
    id: 'schema',
    title: 'Schema Reference',
    description:
      'JSON Schema documentation for validation. Use this to validate your table files and understand the exact structure.',
    icon: Database,
    path: '/guide/schema',
    color: 'rose',
    tags: ['JSON Schema', 'Validation'],
  },
]

const colorClasses = {
  mint: {
    icon: 'bg-[hsl(var(--mint)/0.15)] text-[hsl(var(--mint))]',
    border: 'hover:border-[hsl(var(--mint)/0.3)]',
    tag: 'bg-[hsl(var(--mint)/0.1)] text-[hsl(var(--mint))]',
  },
  lavender: {
    icon: 'bg-[hsl(var(--lavender)/0.15)] text-[hsl(var(--lavender))]',
    border: 'hover:border-[hsl(var(--lavender)/0.3)]',
    tag: 'bg-[hsl(var(--lavender)/0.1)] text-[hsl(var(--lavender))]',
  },
  amber: {
    icon: 'bg-[hsl(var(--amber)/0.15)] text-[hsl(var(--amber))]',
    border: 'hover:border-[hsl(var(--amber)/0.3)]',
    tag: 'bg-[hsl(var(--amber)/0.1)] text-[hsl(var(--amber))]',
  },
  rose: {
    icon: 'bg-[hsl(var(--rose)/0.15)] text-[hsl(var(--rose))]',
    border: 'hover:border-[hsl(var(--rose)/0.3)]',
    tag: 'bg-[hsl(var(--rose)/0.1)] text-[hsl(var(--rose))]',
  },
}

export function GuidePage() {
  const [fantasyExpanded, setFantasyExpanded] = useState(false)
  const [sciFiExpanded, setSciFiExpanded] = useState(false)

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-6 py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium animate-fade-in">
          <BookOpen className="h-4 w-4" />
          Documentation
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight animate-slide-up">
          Rolldeo
          <br />
          <span className="gradient-text">Guide</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto animate-slide-up stagger-1">
          Everything you need to create, roll, and share random tables.
          From quick tutorials to complete specifications.
        </p>
      </section>

      {/* Guide Cards Grid */}
      <section className="grid gap-6 md:grid-cols-2">
        {guideCards.map((card, index) => {
          const Icon = card.icon
          const colors = colorClasses[card.color as keyof typeof colorClasses]

          return (
            <Link
              key={card.id}
              to={card.path}
              className={`
                group card-elevated p-6 border border-border/50
                ${colors.border}
                transition-all duration-300 hover:shadow-lg
                animate-slide-up
              `}
              style={{ animationDelay: `${(index + 2) * 0.1}s` }}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${colors.icon}`}>
                  <Icon className="h-6 w-6" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-bold group-hover:text-primary transition-colors">
                      {card.title}
                    </h2>
                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                  </div>

                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                    {card.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2 py-0.5 text-xs rounded-full ${colors.tag}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </section>

      {/* Open Source Section */}
      <section className="card-elevated border border-border/50 p-8 animate-slide-up stagger-4">
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold">Open Source & Free to Use</h2>
          </div>

          <p className="text-muted-foreground max-w-2xl mx-auto">
            Rolldeo is open source. The Random Table Specification and JSON Schema are released
            under <strong className="text-foreground">CC0 (Public Domain)</strong> — use them freely to build your own
            tools, engines, or table collections without any restrictions.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border/50">
              <span className="text-sm text-muted-foreground">Application:</span>
              <a
                href="https://www.apache.org/licenses/LICENSE-2.0"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                Apache 2.0
              </a>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-border/50">
              <span className="text-sm text-muted-foreground">Spec & Schema:</span>
              <a
                href="https://creativecommons.org/publicdomain/zero/1.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                CC0 Public Domain
              </a>
            </div>
          </div>

          <div className="pt-2">
            <a
              href="https://github.com/RolldeoDev/rolldeo"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2"
            >
              <Github className="h-4 w-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Downloads Section */}
      <section className="card-elevated border border-border/50 p-8 animate-slide-up stagger-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Download Specification Files</h2>
            </div>
            <p className="text-muted-foreground">
              Get the complete spec markdown and JSON schema for offline use or
              integration with your tools.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <DownloadButton
              filename="randomTableSpecV1.md"
              content={specMd}
              mimeType="text/markdown"
              label="Spec (Markdown)"
            />
            <DownloadButton
              filename="random-table-spec-v1.0.json"
              content={schemaJson}
              mimeType="application/json"
              label="Schema (JSON)"
              variant="primary"
            />
          </div>
        </div>
      </section>

      {/* Example Downloads Section */}
      <section className="card-elevated border border-border/50 p-8 animate-slide-up stagger-6">
        <div className="space-y-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Download Pre-built Examples</h2>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Complete example packs demonstrating every feature in the specification.
              Import them into Rolldeo, study the code, and remix them for your own projects.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Fantasy Example */}
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="p-4 bg-amber-500/5 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                      <Swords className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Fantasy Toolkit</h3>
                      <p className="text-sm text-muted-foreground">Dungeon crawling adventures</p>
                    </div>
                  </div>
                  <a
                    href="/guide/examples/fantasyExample.zip"
                    download
                    className="btn-primary text-sm px-4 py-2"
                  >
                    Download
                  </a>
                </div>
              </div>
              <div className="p-4">
                <button
                  onClick={() => setFantasyExpanded(!fantasyExpanded)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${fantasyExpanded ? 'rotate-180' : ''}`} />
                  {fantasyExpanded ? 'Hide contents' : 'Show contents'}
                </button>
                {fantasyExpanded && (
                  <div className="mt-4 space-y-3 text-sm animate-fade-in">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="font-medium mb-1">Monsters.json</div>
                      <p className="text-muted-foreground text-xs">Creatures from common beasts to legendary dragons. Demonstrates weights, sets, defaultSets, collection/composite types, hidden helper tables, and templates.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="font-medium mb-1">Treasure.json</div>
                      <p className="text-muted-foreground text-xs">Loot including coins, gems, weapons, and magic items. Demonstrates dice expressions, shared variables, table references, gem quality modifiers, and cursed items.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="font-medium mb-1">Environments.json</div>
                      <p className="text-muted-foreground text-xs">Dungeons, taverns, wilderness, and urban locations. Demonstrates multiple rolls, unique selections, custom separators, and location atmosphere.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="font-medium mb-1">Encounters.json</div>
                      <p className="text-muted-foreground text-xs">Combat, social, and quest encounters. Demonstrates imports, composite tables, NPC generation, quest hooks, and encounter twists.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sci-Fi Example */}
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="p-4 bg-cyan-500/5 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500">
                      <RocketIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Sci-Fi Worldbuilding</h3>
                      <p className="text-sm text-muted-foreground">Space exploration system</p>
                    </div>
                  </div>
                  <a
                    href="/guide/examples/sciFiExample.zip"
                    download
                    className="btn-primary text-sm px-4 py-2"
                  >
                    Download
                  </a>
                </div>
              </div>
              <div className="p-4">
                <button
                  onClick={() => setSciFiExpanded(!sciFiExpanded)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${sciFiExpanded ? 'rotate-180' : ''}`} />
                  {sciFiExpanded ? 'Hide contents' : 'Show contents'}
                </button>
                {sciFiExpanded && (
                  <div className="mt-4 space-y-3 text-sm animate-fade-in">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="font-medium mb-1">Aliens.json</div>
                      <p className="text-muted-foreground text-xs">Alien species with physical and cultural traits. Demonstrates conditionals, template-level shared variables, capture syntax, and species naming.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="font-medium mb-1">Ships.json</div>
                      <p className="text-muted-foreground text-xs">Starships from fighters to battleships. Demonstrates ranges (d100 style), extends inheritance, ship systems, and fleet generation with captures.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="font-medium mb-1">Planets.json</div>
                      <p className="text-muted-foreground text-xs">Planets with environments, resources, and hazards. Demonstrates imports, star classification, colonization status, native life, and multi-world comparison.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="font-medium mb-1">Encounters.json</div>
                      <p className="text-muted-foreground text-xs">Space encounters combining all modules. Demonstrates multiple imports, complex captures, combat/peaceful variants, and full scenario generation.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Tips */}
      <section className="grid gap-4 md:grid-cols-3 animate-slide-up">
        <QuickTip
          icon={<Sparkles className="h-5 w-5" />}
          title="Start Simple"
          description="Begin with the Quickstart guide to learn the basics before diving into advanced features."
        />
        <QuickTip
          icon={<FileCode className="h-5 w-5" />}
          title="Use the Editor"
          description="The built-in editor validates your tables in real-time against the JSON schema."
        />
        <QuickTip
          icon={<Database className="h-5 w-5" />}
          title="Schema Validation"
          description="Import the JSON schema into your IDE for autocomplete and validation while editing."
        />
      </section>
    </div>
  )
}

function QuickTip({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
      <div className="flex items-center gap-2 mb-2 text-primary">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export default GuidePage
