import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CollectionMeta } from '@/stores/collectionStore'
import type { BrowserItem } from '@/hooks/useBrowserFilter'
import { CollectionAccordionItem } from './CollectionAccordionItem'

const fixture = vi.hoisted(() => ({ query: '', items: [] as BrowserItem[] }))
vi.mock('@/stores/collectionStore', () => {
  const state = {
    collections: new Map([['review', {}]]),
    getTableList: () => [
      { id: 'first', name: 'Unrelated Contents', type: 'simple', entryCount: 1 },
      { id: 'second', name: 'Other Contents', type: 'simple', entryCount: 1 },
      { id: 'hidden', name: 'Hidden Contents', type: 'simple', hidden: true, entryCount: 1 },
    ],
    getTemplateList: () => [],
  }
  return { useCollectionStore: Object.assign((select: (s: typeof state) => unknown) => select(state), { getState: () => state }) }
})
vi.mock('@/stores/uiStore', () => ({
  useUIStore: (select: (state: Record<string, unknown>) => unknown) => select({
    browserActiveTab: 'tables', browserViewMode: 'flat', browserGroupBy: null, showHiddenTables: false,
    rollerCollectionSearchQuery: fixture.query,
    setBrowserActiveTab: vi.fn(), setBrowserViewMode: vi.fn(), setBrowserGroupBy: vi.fn(),
  }),
}))
vi.mock('./VirtualizedItemList', () => ({
  VirtualizedItemList: ({ items }: { items: BrowserItem[] }) => { fixture.items = items; return null },
}))

const collection: CollectionMeta = {
  id: 'review', name: 'Matching Catalogue', namespace: 'review.ui', sourcePublisher: 'Named Publisher',
  version: '1.0.0', tags: [], tableCount: 3, templateCount: 0, isPreloaded: false, source: 'user',
}

function renderSearch(query: string) {
  fixture.query = query
  renderToStaticMarkup(<CollectionAccordionItem collection={collection} isExpanded selectedItemKey={null}
    shouldScrollIntoView={false} onScrollComplete={() => {}} onToggleExpand={() => {}}
    onSelectItem={() => {}} onRollItem={() => {}} />)
  return fixture.items.map(item => item.id)
}

describe('collection browser search scope', () => {
  it.each(['Matching Catalogue', 'Named Publisher', '  Named Publisher  '])('exposes visible contents for metadata match %s', (query) => {
    expect(renderSearch(query)).toEqual(['first', 'second'])
  })

  it('narrows results for an item match and preserves hidden filtering', () => {
    expect(renderSearch('Unrelated')).toEqual(['first'])
    expect(renderSearch('Hidden')).toEqual([])
  })
})
