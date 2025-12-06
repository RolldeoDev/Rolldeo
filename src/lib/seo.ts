/**
 * SEO Configuration
 *
 * Centralized SEO constants and per-page metadata for Rolldeo.
 */

export const SITE_URL = 'https://rolldeo.com'
export const SITE_NAME = 'Rolldeo'
export const DEFAULT_TITLE = 'Rolldeo - Share the Perfect Random Table'
export const DEFAULT_DESCRIPTION =
  'Create, share, and roll on random tables for TTRPGs. Works offline, supports dice expressions, table references, templates, and more.'
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`

export interface PageSEO {
  title: string
  description: string
  path: string
  noindex?: boolean
}

export const PAGE_SEO: Record<string, PageSEO> = {
  home: {
    title: 'Rolldeo - Share the Perfect Random Table',
    description:
      'Create, share, and roll on random tables for TTRPGs. Offline-first, open source, and CC0 licensed.',
    path: '/',
  },
  library: {
    title: 'Library - Browse Table Collections | Rolldeo',
    description:
      'Browse and manage your random table collections. Import JSON files, organize by namespace, and find the perfect table for your game.',
    path: '/library',
  },
  roll: {
    title: 'Roll - Random Table Roller | Rolldeo',
    description:
      'Roll on random tables with support for dice expressions, weighted entries, and table references. Track your roll history.',
    path: '/roll',
  },
  editor: {
    title: 'Editor - Create Random Tables | Rolldeo',
    description:
      'Create and edit random table collections with a visual editor or JSON mode. Real-time validation against the Random Table JSON Spec.',
    path: '/editor',
  },
  guide: {
    title: 'Guide - Documentation | Rolldeo',
    description:
      'Learn how to use Rolldeo, create random tables, and master the Random Table JSON Specification.',
    path: '/guide',
  },
  quickstart: {
    title: 'Getting Started - Quickstart Guide | Rolldeo',
    description:
      'Learn the basics of random tables in under 10 minutes. Create your first table, add weights, roll dice, and more.',
    path: '/guide/quickstart',
  },
  spec: {
    title: 'Random Table JSON Specification v1.0 | Rolldeo',
    description:
      'Complete reference for the Random Table JSON Spec v1.0. Covers dice expressions, table references, templates, conditionals, and more.',
    path: '/guide/spec',
  },
  schema: {
    title: 'JSON Schema Reference | Rolldeo',
    description:
      'JSON Schema documentation for validating Random Table files. Use with your IDE for autocomplete and validation.',
    path: '/guide/schema',
  },
  usingRolldeo: {
    title: 'Using Rolldeo - Feature Guide | Rolldeo',
    description:
      'Master the Library, Roller, and Editor. Learn how to import collections, roll on tables, and create your own.',
    path: '/guide/using-rolldeo',
  },
}
