/**
 * GuidePage
 *
 * Landing page for the Guide section with navigation cards and download buttons.
 */

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
} from 'lucide-react'
import { DownloadButton } from '@/components/guide'

// Import raw markdown files for download
import specMd from '@/../docs/randomTableSpecV1.md?raw'
import schemaMd from '@/../docs/randomTableSchemaV1.json?raw'

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
      'Complete reference for the Random Table JSON Spec v1.2. Covers all features including imports, inheritance, and conditionals.',
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

      {/* Downloads Section */}
      <section className="card-elevated border border-border/50 p-8 animate-slide-up stagger-4">
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
              filename="randomTableSchemaV1.json"
              content={schemaMd}
              mimeType="application/json"
              label="Schema (JSON)"
              variant="primary"
            />
          </div>
        </div>
      </section>

      {/* Quick Tips */}
      <section className="grid gap-4 md:grid-cols-3 animate-slide-up stagger-5">
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
