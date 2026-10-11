import type { BrowserItem } from '@/hooks/useBrowserFilter'
import type { TableInfo, TemplateInfo } from '@/engine/core'

/** A table and template may share an ID, including across collections. */
export function browserItemKey(collectionId: string, item: Pick<BrowserItem, 'type' | 'id'>): string {
  return JSON.stringify([collectionId, item.type, item.id])
}

/** Keep legacy route paths while making the generator kind explicit. */
export function rollerItemUrl(collectionId: string, item: Pick<BrowserItem, 'type' | 'id'>): string {
  return `/roll/${encodeURIComponent(collectionId)}/${encodeURIComponent(item.id)}?kind=${item.type}`
}

/** Legacy links without a kind retain their table-first behavior. */
export function browserItemFromRoute(tables: TableInfo[], templates: TemplateInfo[], id: string, kind: string | null): BrowserItem | null {
  const table = kind === 'template' ? undefined : tables.find(item => item.id === id)
  if (table) return {
    id: table.id, name: table.name, type: 'table', tableType: table.type,
    description: table.description, tags: table.tags, hidden: table.hidden,
    entryCount: table.entryCount, resultType: table.resultType,
  }
  const template = kind === 'table' ? undefined : templates.find(item => item.id === id)
  if (template) return {
    id: template.id, name: template.name, type: 'template',
    description: template.description, tags: template.tags, resultType: template.resultType,
  }
  return null
}
