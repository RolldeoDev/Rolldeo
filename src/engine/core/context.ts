/**
 * Generation Context
 *
 * Manages state during a single generation run.
 * Tracks variables, placeholders, recursion depth, and unique selections.
 */

import type { EngineConfig, Sets, RollResult, CaptureVariable } from '../types'
import type { TraceContext } from './trace'
import { createTraceContext } from './trace'

// ============================================================================
// Types
// ============================================================================

export interface GenerationContext {
  /** Static variables (loaded from document at engine init) */
  staticVariables: Map<string, string>

  /** Shared variables (evaluated once per generation) */
  sharedVariables: Map<string, string | number>

  /** Document-level shared variable names (for shadowing prevention) */
  documentSharedNames: Set<string>

  /** Placeholder values keyed by placeholder name */
  placeholders: Map<string, Sets>

  /** Current recursion depth for table rolls */
  recursionDepth: number

  /** Tracking used entries for unique selection: tableId → Set of entry IDs */
  usedEntries: Map<string, Set<string>>

  /** Instance results for {{tableId#instanceName}} syntax */
  instanceResults: Map<string, RollResult>

  /** Capture variables for roll capture system: {{N*table >> $var}} */
  captureVariables: Map<string, CaptureVariable>

  /** Engine configuration */
  config: EngineConfig

  /** Current table ID (for {{again}}) */
  currentTableId?: string

  /** Current entry ID (for {{again}} exclusion) */
  currentEntryId?: string

  /** Current collection ID */
  currentCollectionId?: string

  /** Optional trace context - only present when tracing is enabled */
  trace?: TraceContext
}

// ============================================================================
// Context Factory
// ============================================================================

export interface CreateContextOptions {
  /** Enable trace mode for this generation */
  enableTrace?: boolean
}

/**
 * Create a fresh generation context
 */
export function createContext(
  config: EngineConfig,
  staticVariables?: Map<string, string>,
  options?: CreateContextOptions
): GenerationContext {
  return {
    staticVariables: staticVariables ?? new Map(),
    sharedVariables: new Map(),
    documentSharedNames: new Set(),
    placeholders: new Map(),
    recursionDepth: 0,
    usedEntries: new Map(),
    instanceResults: new Map(),
    captureVariables: new Map(),
    config,
    currentTableId: undefined,
    currentEntryId: undefined,
    currentCollectionId: undefined,
    trace: options?.enableTrace ? createTraceContext() : undefined,
  }
}

/**
 * Clone a context for nested operations
 * Used when entering a new table roll to preserve parent state
 */
export function cloneContext(ctx: GenerationContext): GenerationContext {
  return {
    staticVariables: ctx.staticVariables, // Shared reference (immutable during generation)
    sharedVariables: ctx.sharedVariables, // Shared reference
    documentSharedNames: ctx.documentSharedNames, // Shared reference (immutable after init)
    placeholders: new Map(ctx.placeholders), // Shallow clone for isolation
    recursionDepth: ctx.recursionDepth,
    usedEntries: ctx.usedEntries, // Shared reference for unique tracking
    instanceResults: ctx.instanceResults, // Shared reference
    captureVariables: ctx.captureVariables, // Shared reference - captures persist across nested calls
    config: ctx.config,
    currentTableId: ctx.currentTableId,
    currentEntryId: ctx.currentEntryId,
    currentCollectionId: ctx.currentCollectionId,
    trace: ctx.trace, // Shared reference - trace tree is built across all nested calls
  }
}

// ============================================================================
// Variable Resolution
// ============================================================================

/**
 * Resolve a variable by name.
 * Lookup order: shared → static
 */
export function resolveVariable(
  ctx: GenerationContext,
  name: string,
  _alias?: string
): string | number | undefined {
  // TODO: Handle alias resolution when imports are implemented
  // For now, we just look up the variable name directly

  // Check shared variables first
  if (ctx.sharedVariables.has(name)) {
    return ctx.sharedVariables.get(name)
  }

  // Then static variables
  if (ctx.staticVariables.has(name)) {
    return ctx.staticVariables.get(name)
  }

  return undefined
}

/**
 * Set a shared variable (during generation)
 */
export function setSharedVariable(
  ctx: GenerationContext,
  name: string,
  value: string | number
): void {
  ctx.sharedVariables.set(name, value)
}

/**
 * Register a document-level shared variable name (for shadowing prevention)
 */
export function registerDocumentSharedName(ctx: GenerationContext, name: string): void {
  ctx.documentSharedNames.add(name)
}

/**
 * Check if a shared variable name would shadow a document-level shared variable
 */
export function wouldShadowDocumentShared(ctx: GenerationContext, name: string): boolean {
  return ctx.documentSharedNames.has(name)
}

// ============================================================================
// Placeholder Resolution
// ============================================================================

/**
 * Get a placeholder value
 */
export function getPlaceholder(
  ctx: GenerationContext,
  name: string,
  property?: string
): string | undefined {
  const sets = ctx.placeholders.get(name)
  if (!sets) return undefined

  if (property) {
    return sets[property]
  }

  // Return the 'value' property by default
  return sets['value']
}

/**
 * Set placeholder values
 */
export function setPlaceholders(
  ctx: GenerationContext,
  name: string,
  sets: Sets
): void {
  // Deep merge with existing placeholders
  const existing = ctx.placeholders.get(name) ?? {}
  ctx.placeholders.set(name, { ...existing, ...sets })
}

/**
 * Merge placeholder sets from an entry selection
 */
export function mergePlaceholderSets(
  ctx: GenerationContext,
  tableName: string,
  sets: Sets
): void {
  // Sets are keyed by table name for @tableName.property access
  setPlaceholders(ctx, tableName, sets)
}

// ============================================================================
// Recursion Tracking
// ============================================================================

/**
 * Increment recursion depth and check limit
 * Returns true if within limit, false if exceeded
 */
export function incrementRecursion(ctx: GenerationContext): boolean {
  ctx.recursionDepth++
  return ctx.recursionDepth <= ctx.config.maxRecursionDepth
}

/**
 * Decrement recursion depth (after returning from nested call)
 */
export function decrementRecursion(ctx: GenerationContext): void {
  ctx.recursionDepth = Math.max(0, ctx.recursionDepth - 1)
}

// ============================================================================
// Unique Selection Tracking
// ============================================================================

/**
 * Get the set of used entry IDs for a table
 */
export function getUsedEntries(ctx: GenerationContext, tableId: string): Set<string> {
  if (!ctx.usedEntries.has(tableId)) {
    ctx.usedEntries.set(tableId, new Set())
  }
  return ctx.usedEntries.get(tableId)!
}

/**
 * Mark an entry as used for unique selection
 */
export function markEntryUsed(ctx: GenerationContext, tableId: string, entryId: string): void {
  getUsedEntries(ctx, tableId).add(entryId)
}

/**
 * Check if an entry has been used
 */
export function isEntryUsed(ctx: GenerationContext, tableId: string, entryId: string): boolean {
  return getUsedEntries(ctx, tableId).has(entryId)
}

/**
 * Clear used entries for a table (reset unique pool)
 */
export function clearUsedEntries(ctx: GenerationContext, tableId: string): void {
  ctx.usedEntries.delete(tableId)
}

// ============================================================================
// Instance Tracking
// ============================================================================

/**
 * Store an instance result
 */
export function setInstance(ctx: GenerationContext, name: string, result: RollResult): void {
  ctx.instanceResults.set(name, result)
}

/**
 * Get an instance result
 */
export function getInstance(ctx: GenerationContext, name: string): RollResult | undefined {
  return ctx.instanceResults.get(name)
}

// ============================================================================
// Capture Variable Resolution
// ============================================================================

/**
 * Get a capture variable by name
 */
export function getCaptureVariable(
  ctx: GenerationContext,
  name: string
): CaptureVariable | undefined {
  return ctx.captureVariables.get(name)
}

/**
 * Set a capture variable.
 * Returns true if overwriting an existing variable (for warning purposes)
 */
export function setCaptureVariable(
  ctx: GenerationContext,
  name: string,
  variable: CaptureVariable
): boolean {
  const exists = ctx.captureVariables.has(name)
  ctx.captureVariables.set(name, variable)
  return exists
}

/**
 * Check if a name conflicts with existing variables
 * Returns the type of conflict or null if no conflict
 */
export function hasVariableConflict(
  ctx: GenerationContext,
  name: string
): 'capture' | 'shared' | 'static' | null {
  if (ctx.captureVariables.has(name)) return 'capture'
  if (ctx.sharedVariables.has(name)) return 'shared'
  if (ctx.staticVariables.has(name)) return 'static'
  return null
}

// ============================================================================
// Current Roll State
// ============================================================================

/**
 * Set the current table being rolled (for {{again}})
 */
export function setCurrentTable(
  ctx: GenerationContext,
  tableId: string,
  entryId?: string
): void {
  ctx.currentTableId = tableId
  ctx.currentEntryId = entryId
}

/**
 * Set the current collection
 */
export function setCurrentCollection(ctx: GenerationContext, collectionId: string): void {
  ctx.currentCollectionId = collectionId
}
