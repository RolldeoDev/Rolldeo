/**
 * Reference Resolver
 *
 * Pure functions for resolving table and template references.
 * Handles namespace, alias, and import resolution.
 */

import type { AuthoredTable, Template, LoadedCollection } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface ResolverContext {
  /** Map of collection IDs to loaded collections */
  collections: Map<string, LoadedCollection>
}

export interface TableResolution {
  table: AuthoredTable
  collectionId: string
}

export interface TemplateResolution {
  template: Template
  collectionId: string
}

/** Resolve one exact namespace. Ambiguous namespaces are errors, never load-order choices. */
export function findNamespace(namespace: string, ctx: ResolverContext): LoadedCollection | undefined {
  const matches = [...ctx.collections.values()].filter(c => c.document.metadata.namespace === namespace)
  if (matches.length > 1) throw new Error(`REFERENCE_ERROR: Ambiguous namespace: '${namespace}'`)
  return matches[0]
}

/** Aliases are authoritative even when unresolved; never fall through to another namespace. */
export function resolveCollectionQualifier(
  qualifier: string, collectionId: string, ctx: ResolverContext
): LoadedCollection | undefined {
  let remaining = qualifier
  let ownerId = collectionId
  while (remaining) {
    const current = ctx.collections.get(ownerId)
    const dot = remaining.indexOf('.')
    const prefix = dot < 0 ? remaining : remaining.slice(0, dot)
    const definition = current?.document.imports?.find(imp => imp.alias === prefix)
    const hasAlias = current?.imports.has(prefix) || current?.importBindingIds?.has(prefix) || definition
    if (!hasAlias) return findNamespace(remaining, ctx)
    let imported: LoadedCollection | undefined
    if (current?.importBindingIds?.has(prefix)) imported = ctx.collections.get(current.importBindingIds.get(prefix)!)
    else imported = current?.imports.get(prefix) ?? (definition
      ? ctx.collections.get(definition.path) ?? findNamespace(definition.path, ctx) : undefined)
    if (!imported || dot < 0) return imported
    ownerId = imported.id
    remaining = remaining.slice(dot + 1)
  }
  return undefined
}

export function resolveTableRef(
  ref: string, collectionId: string, ctx: ResolverContext
): TableResolution | undefined {
  const dot = ref.lastIndexOf('.')
  const owner = dot < 0 ? ctx.collections.get(collectionId)
    : resolveCollectionQualifier(ref.slice(0, dot), collectionId, ctx)
  const table = owner?.tableIndex.get(dot < 0 ? ref : ref.slice(dot + 1))
  return table && owner ? { table, collectionId: owner.id } : undefined
}

export function resolveTemplateRef(
  ref: string, collectionId: string, ctx: ResolverContext
): TemplateResolution | undefined {
  const dot = ref.lastIndexOf('.')
  const owner = dot < 0 ? ctx.collections.get(collectionId)
    : resolveCollectionQualifier(ref.slice(0, dot), collectionId, ctx)
  const template = owner?.templateIndex.get(dot < 0 ? ref : ref.slice(dot + 1))
  return template && owner ? { template, collectionId: owner.id } : undefined
}
