import { validateDocument } from '@/engine/core/validator'
import type { AuthoredRandomTableDocument as RandomTableDocument } from '@/engine/types'

/** The raw text is authoritative; diagnostics from another editor revision cannot authorize saving. */
export function parseDraftSnapshot(json: string): RandomTableDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Please fix JSON syntax before saving or exporting')
  }
  const validation = validateDocument(parsed)
  if (!validation.valid) {
    throw new Error(validation.errors.slice(0, 3).map(issue => issue.message).join('; ') + (validation.errors.length > 3 ? `; and ${validation.errors.length - 3} more validation errors` : ''))
  }
  return parsed as RandomTableDocument
}

/** Allocate within one reference namespace (tables and templates share it). */
export function nextAvailableId(prefix: string, ids: Iterable<string>): string {
  const used = new Set(ids)
  let suffix = 1
  while (used.has(`${prefix}${suffix}`)) suffix++
  return `${prefix}${suffix}`
}

/** Save completion advances the baseline, but never replaces the latest draft. */
export function savedDraftState(currentJson: string, savedJson: string) {
  return { jsonContent: currentJson, originalJson: savedJson, isDirty: currentJson !== savedJson }
}

/** Editor-only identities survive replacement/reorder without leaking into exported JSON. */
export function createSessionItemKeys<T extends object>() {
  const keys = new WeakMap<T, string>()
  let nextKey = 0
  const get = (item: T) => {
    let key = keys.get(item)
    if (!key) {
      key = `editor-item-${nextKey++}`
      keys.set(item, key)
    }
    return key
  }
  return { get, replace: (previous: T, replacement: T) => keys.set(replacement, get(previous)) }
}
