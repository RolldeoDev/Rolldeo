import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Sparkles } from 'lucide-react'
import { browserItemKey, browserItemFromRoute, rollerItemUrl } from './browserIdentity'
import { getResultTypeIcon } from './resultTypeIcons'

describe('browser generator identity', () => {
  it('distinguishes matching IDs across collections and kinds', () => {
    const identities = [
      browserItemKey('first', { id: 'same', type: 'table' }),
      browserItemKey('first', { id: 'same', type: 'template' }),
      browserItemKey('second', { id: 'same', type: 'table' }),
    ]
    expect(new Set(identities).size).toBe(3)
  })

  it('preserves kind and encodes identifiers in navigable links', () => {
    const url = new URL(rollerItemUrl('collection with spaces', { id: 'same', type: 'template' }), 'https://rolldeo.test')
    expect(decodeURIComponent(url.pathname)).toBe('/roll/collection with spaces/same')
    expect(url.searchParams.get('kind')).toBe('template')
  })

  it('selects the requested kind when table and template IDs collide, and preserves legacy links', () => {
    const tables = [{ id: 'same', name: 'Table', type: 'simple' as const, entryCount: 1 }]
    const templates = [{ id: 'same', name: 'Template' }]
    expect(browserItemFromRoute(tables, templates, 'same', 'template')?.type).toBe('template')
    expect(browserItemFromRoute(tables, templates, 'same', 'table')?.type).toBe('table')
    expect(browserItemFromRoute(tables, templates, 'same', null)?.type).toBe('table')
    expect(browserItemFromRoute([], templates, 'same', null)?.type).toBe('template')
    expect(browserItemFromRoute([], templates, 'same', 'table')).toBeNull()
    expect(browserItemFromRoute(tables, [], 'same', 'template')).toBeNull()
  })
})

describe('custom result type rendering', () => {
  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'custom'])('renders fallback for %s', (resultType) => {
    const Icon = getResultTypeIcon(resultType)
    expect(Icon).toBe(Sparkles)
    expect(() => renderToStaticMarkup(<Icon />)).not.toThrow()
  })
})
