import { Rocket, FileCode, Database, Monitor } from 'lucide-react'

// Navigation sections for the guide
export const guideSections = [
  {
    id: 'quickstart',
    label: 'Getting Started',
    path: '/guide/quickstart',
    icon: Rocket,
    description: 'Learn the basics',
  },
  {
    id: 'using-rolldeo',
    label: 'Using Rolldeo',
    path: '/guide/using-rolldeo',
    icon: Monitor,
    description: 'Site features guide',
  },
  {
    id: 'spec',
    label: 'Full Specification',
    path: '/guide/spec',
    icon: FileCode,
    description: 'Complete reference',
  },
  {
    id: 'schema',
    label: 'Schema Reference',
    path: '/guide/schema',
    icon: Database,
    description: 'JSON schema docs',
  },
]
